import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { parseEvolutionWebhook } from '../../lib/evolution.js';
import { requireSession } from '../../lib/auth-guard.js';
import { loadEnv } from '../../config/env.js';
import { encryptSecret } from '../../lib/secrets.js';

const webhookBodySchema = z.object({
  event: z.string().optional(),
  instance: z.string().optional(),
}).passthrough();

const createInstanceSchema = z.object({
  name: z.string().min(2),
  evolutionInstanceName: z.string().min(2),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  webhookSecret: z.string().min(1).optional(),
});

const env = loadEnv();

function pickHeaderSecret(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' ? value : null;
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
    const session = requireSession(request, reply);
    if (!session) return;

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
    const session = requireSession(request, reply);
    if (!session) return;
    if (session.role !== 'admin') {
      return reply.forbidden('Somente administradores podem criar instancias do WhatsApp.');
    }

    const body = createInstanceSchema.parse(request.body);
    const item = await app.prisma.whatsAppInstance.create({
      data: {
        id: randomUUID(),
        name: body.name,
        evolutionInstanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        apiKeyEncrypted: encryptSecret(body.apiKey, env.SESSION_SECRET),
        webhookSecret: body.webhookSecret,
        status: 'connected',
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
};
