import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { parseEvolutionWebhook } from '../../lib/evolution.js';
import { requirePermission } from '../../lib/auth-guard.js';
import { loadEnv } from '../../config/env.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';
import { configureEvolutionWebhook } from '../../lib/evolution-client.js';

const webhookBodySchema = z.object({
  event: z.string().optional(),
  instance: z.string().optional(),
}).passthrough();

const optionalWebhookSecretSchema = z.string().trim().optional().transform((value) => {
  if (!value) return undefined;
  return value;
});

const createInstanceSchema = z.object({
  name: z.string().min(2),
  evolutionInstanceName: z.string().min(2),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  webhookSecret: optionalWebhookSecretSchema,
});

const updateInstanceSchema = z.object({
  name: z.string().min(2),
  evolutionInstanceName: z.string().min(2),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).optional().or(z.literal('')),
  webhookSecret: optionalWebhookSecretSchema,
});

const env = loadEnv();

function pickHeaderSecret(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : null;
  }

  return typeof value === 'string' ? value : null;
}

function resolvePublicApiBase(request: { headers: Record<string, unknown> }) {
  if (env.API_PUBLIC_URL) {
    return env.API_PUBLIC_URL.replace(/\/$/, '');
  }

  const forwardedProto = pickHeaderSecret(request.headers['x-forwarded-proto']) ?? 'https';
  const forwardedHost = pickHeaderSecret(request.headers['x-forwarded-host']);
  const host = pickHeaderSecret(request.headers.host);
  const origin = pickHeaderSecret(request.headers.origin);
  const referer = pickHeaderSecret(request.headers.referer);

  if (forwardedHost && !forwardedHost.includes(':3333') && !forwardedHost.includes('api:')) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
  }

  if (host && !host.includes(':3333') && !host.includes('api:')) {
    return `${forwardedProto}://${host}`.replace(/\/$/, '');
  }

  const candidate = origin ?? referer;
  if (candidate) {
    const parsed = candidate.replace(/\/$/, '');
    if (parsed.includes('chatflow-web.')) {
      return parsed.replace('chatflow-web.', 'chatflow-api.');
    }
  }

  return null;
}

function normalizeConnectionPhone(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits : null;
}

function resolveInstanceSnapshot(event: string, payload: Prisma.InputJsonValue | Record<string, unknown>) {
  const raw = payload as Record<string, any>;
  const data = (raw?.data && typeof raw.data === 'object' ? raw.data : {}) as Record<string, any>;
  const stateCandidate = [
    data.state,
    data.status,
    data.connection,
    data.instance?.state,
    data.instance?.status,
  ].find((value) => typeof value === 'string') as string | undefined;

  const phoneCandidate = [
    data.number,
    data.phone,
    data.owner,
    data.instance?.number,
    data.instance?.owner,
  ].find((value) => typeof value === 'string');

  const normalizedState = stateCandidate?.toLowerCase() ?? '';
  let status: 'connected' | 'disconnected' | 'pairing' | 'error' | null = null;

  if (event === 'QRCODE_UPDATED') {
    status = 'pairing';
  } else if (['open', 'connected'].includes(normalizedState)) {
    status = 'connected';
  } else if (['close', 'closed', 'disconnected', 'disconnect'].includes(normalizedState)) {
    status = 'disconnected';
  } else if (['connecting', 'pairing', 'qr', 'qrcode'].includes(normalizedState)) {
    status = 'pairing';
  } else if (['error', 'refused', 'timeout'].includes(normalizedState)) {
    status = 'error';
  }

  return {
    status,
    phoneNumber: normalizeConnectionPhone(phoneCandidate),
  };
}

export const whatsappRoutes: FastifyPluginAsync = async (app) => {
  async function finalizeWebhookLog(logId: string, statusCode: number, errorMessage?: string) {
    await app.prisma.webhookLog.update({
      where: { id: logId },
      data: {
        processedAt: new Date(),
        statusCode,
        errorMessage,
      },
    });
  }

  app.post('/webhooks/evolution', async (request, reply) => {
    const body = webhookBodySchema.parse(request.body);
    const parsed = parseEvolutionWebhook(body);

    const instance = parsed.instanceName
      ? await app.prisma.whatsAppInstance.findFirst({
          where: {
            OR: [
              { evolutionInstanceName: parsed.instanceName },
              { name: parsed.instanceName },
            ],
          },
        })
      : null;

    const webhookLog = await app.prisma.webhookLog.create({
      data: {
        id: randomUUID(),
        source: 'evolution',
        eventName: parsed.event,
        whatsappInstanceId: instance?.id,
        payload: parsed.rawPayload as Prisma.InputJsonValue,
        receivedAt: new Date(),
      },
    });

    const query = (request.query ?? {}) as Record<string, unknown>;
    const incomingSecret =
      pickHeaderSecret(request.headers['x-webhook-secret'])
      ?? pickHeaderSecret(request.headers['x-chatflow-secret'])
      ?? (typeof query.secret === 'string' ? query.secret : null);

    if (instance?.webhookSecret && incomingSecret !== instance.webhookSecret) {
      await finalizeWebhookLog(webhookLog.id, 401, 'Segredo do webhook invalido.');
      return reply.code(401).send({
        message: 'Segredo do webhook invalido.',
      });
    }

    if (instance) {
      const snapshot = resolveInstanceSnapshot(parsed.event, parsed.rawPayload);
      if (snapshot.status || snapshot.phoneNumber) {
        const updatedInstance = await app.prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            ...(snapshot.status ? { status: snapshot.status } : {}),
            ...(snapshot.phoneNumber ? { phoneNumber: snapshot.phoneNumber } : {}),
            lastSeenAt: new Date(),
          },
          select: {
            id: true,
            status: true,
            phoneNumber: true,
          },
        });

        app.io.emit('instance.updated', {
          instanceId: updatedInstance.id,
          status: updatedInstance.status,
          phoneNumber: updatedInstance.phoneNumber,
        });
      }
    }

    if (!instance || !parsed.remoteJid) {
      await finalizeWebhookLog(webhookLog.id, 202, 'Webhook registrado sem persistencia de ticket.');
      return reply.code(202).send({
        message: 'Webhook registrado sem persistencia de ticket.',
        event: parsed.event,
        instance: parsed.instanceName,
      });
    }

    try {
      const customer = parsed.isGroup || !parsed.phone
        ? null
        : await app.prisma.customer.upsert({
            where: { phoneE164: parsed.phone },
            update: {
              name: parsed.pushName ?? parsed.phone,
            },
            create: {
              id: randomUUID(),
              name: parsed.pushName ?? parsed.phone,
              phoneE164: parsed.phone,
            },
          });

      let ticket = await app.prisma.ticket.findFirst({
        where: {
          whatsappInstanceId: instance.id,
          externalChatId: parsed.remoteJid,
          status: { in: ['open', 'pending'] },
        },
      });

      if (!ticket) {
        ticket = await app.prisma.ticket.create({
          data: {
            id: randomUUID(),
            customerId: customer?.id,
            whatsappInstanceId: instance.id,
            externalChatId: parsed.remoteJid,
            externalContactId: parsed.phone,
            customerNameSnapshot: parsed.isGroup ? (parsed.pushName ?? 'Grupo WhatsApp') : (customer?.name ?? parsed.pushName ?? parsed.phone ?? 'Contato sem nome'),
            status: parsed.fromMe ? 'open' : 'pending',
            unreadCount: parsed.fromMe ? 0 : 1,
            isGroup: parsed.isGroup,
            lastMessagePreview: parsed.body,
          },
        });

        await app.prisma.ticketEvent.create({
          data: {
            id: randomUUID(),
            ticketId: ticket.id,
            eventType: 'created',
            metadata: { source: 'evolution', event: parsed.event },
          },
        });
      } else {
        ticket = await app.prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            customerId: customer?.id ?? ticket.customerId,
            customerNameSnapshot: customer?.name ?? parsed.pushName ?? ticket.customerNameSnapshot,
            lastMessagePreview: parsed.body,
            unreadCount: parsed.fromMe ? 0 : { increment: 1 },
            status: parsed.fromMe ? ticket.status : ticket.currentAgentId ? ticket.status : 'pending',
            updatedAt: new Date(),
          },
        });
      }

      const existingMessage = await app.prisma.ticketMessage.findFirst({
        where: {
          ticketId: ticket.id,
          externalMessageId: parsed.externalMessageId,
        },
      });

      if (!existingMessage) {
        const message = await app.prisma.ticketMessage.create({
          data: {
            id: randomUUID(),
            ticketId: ticket.id,
            externalMessageId: parsed.externalMessageId,
            direction: parsed.fromMe ? 'outbound' : 'inbound',
            contentType: parsed.contentType,
            body: parsed.body,
            senderNameSnapshot: parsed.pushName ?? parsed.phone ?? parsed.remoteJid,
            rawPayload: parsed.rawPayload as Prisma.InputJsonValue,
          },
        });

        await app.prisma.ticketEvent.create({
          data: {
            id: randomUUID(),
            ticketId: ticket.id,
            eventType: parsed.fromMe ? 'message_out' : 'message_in',
            metadata: { messageId: message.id, event: parsed.event },
          },
        });

        app.io.emit('message.created', {
          ticketId: ticket.id,
          messageId: message.id,
          direction: message.direction,
        });
      }

      app.io.emit('ticket.updated', {
        ticketId: ticket.id,
        unreadCount: ticket.unreadCount,
        lastMessagePreview: ticket.lastMessagePreview,
      });

      await finalizeWebhookLog(webhookLog.id, 202);

      return reply.code(202).send({
        message: 'Webhook da Evolution processado.',
        event: parsed.event,
        ticketId: ticket.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro nao tratado no processamento do webhook.';
      await finalizeWebhookLog(webhookLog.id, 500, message);
      throw error;
    }
  });

  app.get('/whatsapp/instances', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'channels.view'))) return;

    const items = await app.prisma.whatsAppInstance.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        evolutionInstanceName: true,
        baseUrl: true,
        status: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.send({ items });
  });

  app.post('/whatsapp/instances', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'channels.manage'))) return;

    const body = createInstanceSchema.parse(request.body);
    const publicApiBase = resolvePublicApiBase(request);

    if (!publicApiBase) {
      return reply.badRequest('Nao foi possivel resolver a URL publica da API. Defina API_PUBLIC_URL no backend.');
    }

    const webhookUrl = body.webhookSecret
      ? `${publicApiBase}/api/webhooks/evolution?secret=${encodeURIComponent(body.webhookSecret)}`
      : `${publicApiBase}/api/webhooks/evolution`;

    const webhookSetup = await configureEvolutionWebhook({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      instanceName: body.evolutionInstanceName,
      webhookUrl,
    });

    if (!webhookSetup.ok) {
      app.log.error({
        action: 'configure_webhook',
        instanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        webhookUrl,
        status: webhookSetup.status,
        payload: webhookSetup.payload,
      }, 'Falha ao configurar webhook da Evolution na criacao da instancia.');

      return reply.code(400).send({
        message: 'Falha ao configurar o webhook da Evolution para esta instancia.',
        status: webhookSetup.status,
        payload: webhookSetup.payload,
      });
    }

    const item = await app.prisma.whatsAppInstance.create({
      data: {
        id: randomUUID(),
        name: body.name,
        evolutionInstanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        apiKeyEncrypted: encryptSecret(body.apiKey, env.SESSION_SECRET),
        webhookSecret: body.webhookSecret,
        status: 'disconnected',
      },
      select: {
        id: true,
        name: true,
        evolutionInstanceName: true,
        baseUrl: true,
        status: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    app.io.emit('instance.updated', { instanceId: item.id, status: item.status });

    return reply.code(201).send({ item });
  });

  app.put('/whatsapp/instances/:instanceId', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'channels.manage'))) return;

    const params = z.object({ instanceId: z.string().uuid() }).parse(request.params);
    const body = updateInstanceSchema.parse(request.body);
    const publicApiBase = resolvePublicApiBase(request);

    if (!publicApiBase) {
      return reply.badRequest('Nao foi possivel resolver a URL publica da API. Defina API_PUBLIC_URL no backend.');
    }

    const existing = await app.prisma.whatsAppInstance.findUnique({
      where: { id: params.instanceId },
      select: { id: true, apiKeyEncrypted: true, webhookSecret: true },
    });

    if (!existing) {
      return reply.notFound('Instância não encontrada.');
    }

    const apiKey = body.apiKey && body.apiKey.trim().length > 0
      ? body.apiKey
      : decryptSecret(existing.apiKeyEncrypted, env.SESSION_SECRET);

    const webhookSecret = body.webhookSecret ?? existing.webhookSecret ?? undefined;
    const webhookUrl = webhookSecret
      ? `${publicApiBase}/api/webhooks/evolution?secret=${encodeURIComponent(webhookSecret)}`
      : `${publicApiBase}/api/webhooks/evolution`;

    const webhookSetup = await configureEvolutionWebhook({
      baseUrl: body.baseUrl,
      apiKey,
      instanceName: body.evolutionInstanceName,
      webhookUrl,
    });

    if (!webhookSetup.ok) {
      app.log.error({
        action: 'configure_webhook',
        instanceId: params.instanceId,
        instanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        webhookUrl,
        status: webhookSetup.status,
        payload: webhookSetup.payload,
      }, 'Falha ao atualizar webhook da Evolution.');

      return reply.code(400).send({
        message: 'Falha ao atualizar o webhook da Evolution para esta instancia.',
        status: webhookSetup.status,
        payload: webhookSetup.payload,
      });
    }

    const item = await app.prisma.whatsAppInstance.update({
      where: { id: params.instanceId },
      data: {
        name: body.name,
        evolutionInstanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        ...(body.apiKey ? { apiKeyEncrypted: encryptSecret(body.apiKey, env.SESSION_SECRET) } : {}),
        webhookSecret: body.webhookSecret || null,
      },
      select: {
        id: true,
        name: true,
        evolutionInstanceName: true,
        baseUrl: true,
        status: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    app.io.emit('instance.updated', { instanceId: item.id, status: item.status, action: 'updated' });

    return reply.code(200).send({
      message: 'Instância atualizada com sucesso.',
      item,
    });
  });
};
