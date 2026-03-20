import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { parseEvolutionPayload } from './evolution.js';
import { loadEnv } from '../config/env.js';
import { decryptSecret } from './secrets.js';
import { fetchEvolutionProfilePictureUrl } from './evolution-client.js';
import {
  buildActiveTicketIdentityWhere,
  buildTicketChatIdentity,
  withScopedAdvisoryLock,
  withTicketIdentityLock,
} from './ticket-identity.js';

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

function hasUsableEditedBody(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  return normalized.toLowerCase() !== 'mensagem vazia';
}

function isEmptyPlaceholderUpdate(parsed: ReturnType<typeof parseEvolutionPayload>) {
  return parsed.event === 'MESSAGES_UPDATE'
    && !parsed.isEdited
    && !parsed.reaction
    && !parsed.deletion
    && parsed.attachments.length === 0
    && parsed.contentType === 'other'
    && parsed.body.trim().toLowerCase() === 'mensagem vazia';
}

function normalizeStoredReactions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{
      emoji: string;
      actorType: 'agent' | 'contact';
      actorId: string | null;
      actorName: string | null;
      createdAt: string;
    }>;
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const emoji = typeof record.emoji === 'string' ? record.emoji.trim() : '';
    if (!emoji) {
      return [];
    }

    const actorType = record.actorType === 'agent' ? 'agent' : 'contact';
    return [{
      emoji,
      actorType,
      actorId: typeof record.actorId === 'string' ? record.actorId : null,
      actorName: typeof record.actorName === 'string' ? record.actorName : null,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    }];
  });
}

function withStoredReaction(
  rawPayload: Prisma.JsonValue | null | undefined,
  reaction: {
    emoji: string;
    actorType: 'agent' | 'contact';
    actorId: string | null;
    actorName: string | null;
  },
) {
  const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};

  const current = normalizeStoredReactions(payload.chatflowReactions);
  const next = [
    ...current.filter((item) => !(item.actorType === reaction.actorType && item.actorId === reaction.actorId && item.actorName === reaction.actorName)),
    {
      ...reaction,
      createdAt: new Date().toISOString(),
    },
  ];

  payload.chatflowReactions = next;
  return payload as Prisma.InputJsonValue;
}

function withDeletedMessage(rawPayload: Prisma.JsonValue | null | undefined) {
  const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};

  payload.chatflowDeleted = {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    scope: 'everyone',
  };

  return payload as Prisma.InputJsonValue;
}

async function findOrCreateCustomer(
  prisma: FastifyInstance['prisma'],
  params: { name: string; phoneE164: string; avatarUrl?: string | null; preserveExistingName?: boolean },
) {
  const existing = await prisma.customer.findFirst({
    where: { phoneE164: params.phoneE164 },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    const nextAvatarUrl = params.avatarUrl ?? existing.avatarUrl ?? null;
    const nextName = params.preserveExistingName ? existing.name : params.name;

    if (existing.name !== nextName || existing.avatarUrl !== nextAvatarUrl) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: { name: nextName, avatarUrl: nextAvatarUrl },
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

function resolveCustomerDisplayName(parsed: ReturnType<typeof parseEvolutionPayload>, currentName?: string | null) {
  if (parsed.isGroup) {
    return parsed.groupName ?? currentName ?? 'Grupo WhatsApp';
  }

  if (parsed.fromMe) {
    return parsed.verifiedBizName ?? currentName ?? parsed.phone ?? parsed.remoteJid ?? 'Contato sem nome';
  }

  return parsed.pushName ?? parsed.verifiedBizName ?? currentName ?? parsed.phone ?? parsed.remoteJid ?? 'Contato sem nome';
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

  if (!instance) {
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

    if (isEmptyPlaceholderUpdate(parsed)) {
      app.log.info({
        action: 'evolution_empty_update_ignored',
        event: parsed.event,
        instanceId: instance.id,
        externalMessageId: parsed.externalMessageId,
        remoteJid: parsed.remoteJid,
      }, 'Evento de atualizacao sem conteudo ignorado para evitar mensagem vazia.');

      await finalize(202, 'Evento de atualizacao sem conteudo ignorado.');
      return {
        statusCode: 202,
        body: {
          message: 'Evento de atualizacao sem conteudo ignorado.',
          event: parsed.event,
          externalMessageId: parsed.externalMessageId,
        },
      };
    }

    if (parsed.isEdited) {
      const existingMessage = await app.prisma.ticketMessage.findFirst({
        where: {
          externalMessageId: parsed.externalMessageId,
          ticket: {
            whatsappInstanceId: instance.id,
          },
        },
        include: {
          ticket: true,
        },
      });

      if (!existingMessage || !hasUsableEditedBody(parsed.body)) {
        app.log.warn({
          action: 'evolution_edit_message_not_found',
          event: parsed.event,
          instanceId: instance.id,
          externalMessageId: parsed.externalMessageId,
          remoteJid: parsed.remoteJid,
          hasUsableEditedBody: hasUsableEditedBody(parsed.body),
        }, 'Evento de edicao recebido sem localizar a mensagem base.');

        await finalize(202, 'Evento de edicao sem mensagem base localizada.');
        return {
          statusCode: 202,
          body: {
            message: 'Evento de edicao registrado sem atualizar mensagem.',
            event: parsed.event,
            externalMessageId: parsed.externalMessageId,
          },
        };
      }

      const updatedMessage = await app.prisma.ticketMessage.update({
        where: { id: existingMessage.id },
        data: {
          body: parsed.body,
          contentType: parsed.contentType,
          senderNameSnapshot: parsed.pushName ?? parsed.phone ?? existingMessage.senderNameSnapshot,
          rawPayload: parsed.rawPayload as Prisma.InputJsonValue,
          editedAt: parsed.editedAt ?? new Date(),
        },
      });

      const latestMessage = await app.prisma.ticketMessage.findFirst({
        where: { ticketId: existingMessage.ticketId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (latestMessage?.id === existingMessage.id) {
        await app.prisma.ticket.update({
          where: { id: existingMessage.ticketId },
          data: {
            lastMessagePreview: parsed.body,
          },
        });

        app.io.emit('ticket.updated', {
          ticketId: existingMessage.ticketId,
          lastMessagePreview: parsed.body,
          unreadCount: existingMessage.ticket.unreadCount,
        });
      }

      app.io.emit('message.updated', {
        ticketId: existingMessage.ticketId,
        messageId: updatedMessage.id,
        direction: updatedMessage.direction,
      });

      await finalize(202);

      return {
        statusCode: 202,
        body: {
          message: 'Edicao de mensagem processada.',
          event: parsed.event,
          ticketId: existingMessage.ticketId,
          messageId: updatedMessage.id,
        },
      };
    }

    if (parsed.reaction) {
      const targetMessage = await app.prisma.ticketMessage.findFirst({
        where: {
          externalMessageId: parsed.reaction.targetExternalMessageId,
          ticket: {
            whatsappInstanceId: instance.id,
          },
        },
      });

      if (!targetMessage) {
        app.log.warn({
          action: 'evolution_reaction_message_not_found',
          event: parsed.event,
          instanceId: instance.id,
          externalMessageId: parsed.reaction.targetExternalMessageId,
          remoteJid: parsed.remoteJid,
        }, 'Evento de reacao recebido sem localizar a mensagem base.');

        await finalize(202, 'Evento de reacao sem mensagem base localizada.');
        return {
          statusCode: 202,
          body: {
            message: 'Evento de reacao registrado sem atualizar mensagem.',
            event: parsed.event,
            externalMessageId: parsed.reaction.targetExternalMessageId,
          },
        };
      }

      await app.prisma.ticketMessage.update({
        where: { id: targetMessage.id },
        data: {
          rawPayload: withStoredReaction(targetMessage.rawPayload, {
            emoji: parsed.reaction.emoji,
            actorType: parsed.fromMe ? 'agent' : 'contact',
            actorId: parsed.fromMe ? 'external-device' : parsed.phone,
            actorName: parsed.pushName ?? parsed.phone ?? parsed.remoteJid,
          }),
        },
      });

      app.io.emit('message.updated', {
        ticketId: targetMessage.ticketId,
        messageId: targetMessage.id,
        direction: targetMessage.direction,
      });

      await finalize(202);

      return {
        statusCode: 202,
        body: {
          message: 'Reacao processada.',
          event: parsed.event,
          ticketId: targetMessage.ticketId,
          messageId: targetMessage.id,
        },
      };
    }

    if (parsed.deletion) {
      const targetMessage = await app.prisma.ticketMessage.findFirst({
        where: {
          externalMessageId: parsed.deletion.targetExternalMessageId,
          ticket: {
            whatsappInstanceId: instance.id,
          },
        },
        include: {
          ticket: true,
        },
      });

      if (!targetMessage) {
        app.log.warn({
          action: 'evolution_delete_message_not_found',
          event: parsed.event,
          instanceId: instance.id,
          externalMessageId: parsed.deletion.targetExternalMessageId,
          remoteJid: parsed.remoteJid,
        }, 'Evento de exclusao recebido sem localizar a mensagem base.');

        await finalize(202, 'Evento de exclusao sem mensagem base localizada.');
        return {
          statusCode: 202,
          body: {
            message: 'Evento de exclusao registrado sem atualizar mensagem.',
            event: parsed.event,
            externalMessageId: parsed.deletion.targetExternalMessageId,
          },
        };
      }

      await app.prisma.ticketMessage.update({
        where: { id: targetMessage.id },
        data: {
          rawPayload: withDeletedMessage(targetMessage.rawPayload),
        },
      });

      app.io.emit('message.updated', {
        ticketId: targetMessage.ticketId,
        messageId: targetMessage.id,
        direction: targetMessage.direction,
      });

      await finalize(202);

      return {
        statusCode: 202,
        body: {
          message: 'Exclusao de mensagem processada.',
          event: parsed.event,
          ticketId: targetMessage.ticketId,
          messageId: targetMessage.id,
        },
      };
    }

    if (!parsed.remoteJid) {
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

    const profilePictureResponse = parsed.isGroup || !parsed.remoteJid
      ? null
      : await fetchEvolutionProfilePictureUrl({
          baseUrl: instance.baseUrl,
          apiKey: decryptedApiKey,
          instanceName: instance.evolutionInstanceName,
          remoteJid: parsed.remoteJid,
        }).catch(() => null);
    const fetchedCustomerAvatarUrl = profilePictureResponse?.profilePictureUrl ?? null;
    const desiredCustomerName = resolveCustomerDisplayName(parsed);

    const customer = parsed.isGroup || !parsed.phone
      ? null
      : await findOrCreateCustomer(app.prisma, {
          name: desiredCustomerName,
          phoneE164: parsed.phone,
          avatarUrl: fetchedCustomerAvatarUrl,
          preserveExistingName: parsed.fromMe && !parsed.verifiedBizName,
        });
    const customerAvatarUrl = fetchedCustomerAvatarUrl ?? customer?.avatarUrl ?? null;
    const chatIdentity = buildTicketChatIdentity({
      remoteJid: parsed.remoteJid,
      phone: parsed.phone,
      isGroup: parsed.isGroup,
      aliases: parsed.chatAliases,
    });

    const ticket = await withTicketIdentityLock(app.prisma, {
      whatsappInstanceId: instance.id,
      canonicalChatId: chatIdentity.canonicalChatId ?? parsed.remoteJid,
    }, async (tx) => {
      const existingTicket = await tx.ticket.findFirst({
        where: buildActiveTicketIdentityWhere(instance.id, chatIdentity),
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (!existingTicket) {
        const createdTicket = await tx.ticket.create({
          data: {
            id: randomUUID(),
            customerId: customer?.id,
            whatsappInstanceId: instance.id,
            currentQueueId: instance.defaultQueueId ?? null,
            externalChatId: chatIdentity.canonicalChatId ?? parsed.remoteJid,
            externalContactId: chatIdentity.contactId,
            customerNameSnapshot: resolveCustomerDisplayName(parsed, customer?.name),
            customerAvatarUrl,
            status: 'pending',
            unreadCount: parsed.fromMe ? 0 : 1,
            isGroup: parsed.isGroup,
            lastMessagePreview: parsed.body,
          },
        });

        await tx.ticketEvent.create({
          data: {
            id: randomUUID(),
            ticketId: createdTicket.id,
            eventType: 'created',
            metadata: { source: params.source, event: parsed.event },
          },
        });

        return createdTicket;
      }

      return tx.ticket.update({
        where: { id: existingTicket.id },
        data: {
          customerId: customer?.id ?? existingTicket.customerId,
          externalChatId: chatIdentity.canonicalChatId ?? existingTicket.externalChatId,
          externalContactId: chatIdentity.contactId ?? existingTicket.externalContactId,
          customerNameSnapshot: resolveCustomerDisplayName(parsed, customer?.name ?? existingTicket.customerNameSnapshot),
          customerAvatarUrl: customerAvatarUrl ?? existingTicket.customerAvatarUrl,
          lastMessagePreview: parsed.body,
          unreadCount: parsed.fromMe ? 0 : { increment: 1 },
          status: parsed.fromMe ? existingTicket.status : existingTicket.currentAgentId ? existingTicket.status : 'pending',
          updatedAt: new Date(),
        },
      });
    });

    const messageLockKey = `${instance.id}:${ticket.id}:${parsed.externalMessageId}`;
    const createdMessage = await withScopedAdvisoryLock(app.prisma, {
      scope: 'ticket-message',
      key: messageLockKey,
    }, async (tx) => {
      const existingMessage = await tx.ticketMessage.findFirst({
        where: {
          ticketId: ticket.id,
          externalMessageId: parsed.externalMessageId,
        },
      });

      if (existingMessage) {
        return null;
      }

      const message = await tx.ticketMessage.create({
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
        await tx.attachment.createMany({
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

      await tx.ticketEvent.create({
        data: {
          id: randomUUID(),
          ticketId: ticket.id,
          eventType: parsed.fromMe ? 'message_out' : 'message_in',
          metadata: { messageId: message.id, event: parsed.event },
        },
      });

      return message;
    });

    if (createdMessage) {
      app.io.emit('message.created', {
        ticketId: ticket.id,
        messageId: createdMessage.id,
        direction: createdMessage.direction,
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
