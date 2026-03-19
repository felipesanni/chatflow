import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { parseEvolutionPayload } from './evolution.js';
import { loadEnv } from '../config/env.js';
import { decryptSecret } from './secrets.js';
import { fetchEvolutionProfilePictureUrl } from './evolution-client.js';

const env = loadEnv();

function pickHeaderSecret(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : null;
  }

  return typeof value === 'string' ? value : null;
}

function normalizeConnectionPhone(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits : null;
}

async function findOrCreateCustomer(
  prisma: FastifyInstance['prisma'],
  params: { name: string; phoneE164: string; avatarUrl?: string | null },
) {
  const existing = await prisma.customer.findFirst({
    where: { phoneE164: params.phoneE164 },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    if (existing.name !== params.name || existing.avatarUrl !== (params.avatarUrl ?? null)) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: { name: params.name, avatarUrl: params.avatarUrl ?? null },
      });
    }

    return existing;
  }

  return prisma.customer.create({
    data: {
      id: randomUUID(),
      name: params.name,
      phoneE164: params.phoneE164,
      avatarUrl: params.avatarUrl ?? null,
    },
  });
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

interface ProcessEvolutionEventParams {
  source: string;
  payload: Record<string, unknown>;
  event?: string | null;
  instanceName?: string | null;
  incomingSecret?: string | null;
  validateSecret?: boolean;
}

export async function processEvolutionEvent(app: FastifyInstance, params: ProcessEvolutionEventParams) {
  const parsed = parseEvolutionPayload(params.payload, {
    event: params.event ?? undefined,
    instanceName: params.instanceName ?? undefined,
  });

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
      source: params.source,
      eventName: parsed.event,
      whatsappInstanceId: instance?.id,
      payload: parsed.rawPayload as Prisma.InputJsonValue,
      receivedAt: new Date(),
    },
  });

  async function finalize(statusCode: number, errorMessage?: string) {
    await app.prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        processedAt: new Date(),
        statusCode,
        errorMessage,
      },
    });
  }

  if (params.validateSecret && instance?.webhookSecret && params.incomingSecret !== instance.webhookSecret) {
    await finalize(401, 'Segredo do webhook invalido.');
    return {
      statusCode: 401,
      body: { message: 'Segredo do webhook invalido.' },
    };
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
    await finalize(202, 'Evento registrado sem persistencia de ticket.');
    return {
      statusCode: 202,
      body: {
        message: 'Evento registrado sem persistencia de ticket.',
        event: parsed.event,
        instance: parsed.instanceName,
      },
    };
  }

  try {
    const decryptedApiKey = decryptSecret(instance.apiKeyEncrypted, env.SESSION_SECRET);
    const profilePictureResponse = parsed.isGroup || !parsed.remoteJid
      ? null
      : await fetchEvolutionProfilePictureUrl({
          baseUrl: instance.baseUrl,
          apiKey: decryptedApiKey,
          instanceName: instance.evolutionInstanceName,
          remoteJid: parsed.remoteJid,
        }).catch(() => null);
    const customerAvatarUrl = profilePictureResponse?.profilePictureUrl ?? null;

    const customer = parsed.isGroup || !parsed.phone
      ? null
      : await findOrCreateCustomer(app.prisma, {
          name: parsed.pushName ?? parsed.phone,
          phoneE164: parsed.phone,
          avatarUrl: customerAvatarUrl,
        });

    let ticket = await app.prisma.ticket.findFirst({
      where: {
        whatsappInstanceId: instance.id,
        externalChatId: parsed.remoteJid,
        ...(parsed.fromMe ? {} : { status: { in: ['open', 'pending'] } }),
      },
      orderBy: {
        updatedAt: 'desc',
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
          customerNameSnapshot: parsed.isGroup
            ? (parsed.groupName ?? 'Grupo WhatsApp')
            : (customer?.name ?? parsed.pushName ?? parsed.phone ?? 'Contato sem nome'),
          customerAvatarUrl,
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
          metadata: { source: params.source, event: parsed.event },
        },
      });
    } else {
      ticket = await app.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          customerId: customer?.id ?? ticket.customerId,
          customerNameSnapshot: parsed.isGroup
            ? (parsed.groupName ?? ticket.customerNameSnapshot)
            : (customer?.name ?? parsed.pushName ?? ticket.customerNameSnapshot),
          customerAvatarUrl: customerAvatarUrl ?? ticket.customerAvatarUrl,
          lastMessagePreview: parsed.body,
          unreadCount: parsed.fromMe ? 0 : { increment: 1 },
          status: parsed.fromMe
            ? (ticket.status === 'closed' ? 'open' : ticket.status)
            : ticket.currentAgentId ? ticket.status : 'pending',
          closedAt: parsed.fromMe && ticket.status === 'closed' ? null : ticket.closedAt,
          closedReason: parsed.fromMe && ticket.status === 'closed' ? null : ticket.closedReason,
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

      if (parsed.attachments.length > 0) {
        await app.prisma.attachment.createMany({
          data: parsed.attachments.map((attachment) => ({
            id: randomUUID(),
            messageId: message.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            storage: attachment.storage,
            storageKey: attachment.storageKey,
            publicUrl: attachment.publicUrl,
          })),
        });
      }

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

    await finalize(202);

    return {
      statusCode: 202,
      body: {
        message: 'Evento da Evolution processado.',
        event: parsed.event,
        ticketId: ticket.id,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro nao tratado no processamento do evento.';
    await finalize(500, message);
    throw error;
  }
}

export function pickEvolutionIncomingSecret(headers: Record<string, unknown>, query: Record<string, unknown>) {
  return pickHeaderSecret(headers['x-webhook-secret'])
    ?? pickHeaderSecret(headers['x-chatflow-secret'])
    ?? (typeof query.secret === 'string' ? query.secret : null);
}
