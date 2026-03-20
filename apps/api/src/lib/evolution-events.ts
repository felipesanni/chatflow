import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { parseEvolutionPayload } from './evolution.js';
import { loadEnv } from '../config/env.js';
import { decryptSecret } from './secrets.js';
import { fetchEvolutionGroupName, fetchEvolutionProfilePictureUrl } from './evolution-client.js';
import {
  buildActiveTicketIdentityWhere,
  buildTicketAliasCandidates,
  buildTicketChatIdentity,
  normalizeTicketIdentityPhone,
  withScopedAdvisoryLock,
  withTicketIdentityLock,
} from './ticket-identity.js';

const env = loadEnv();
const GENERIC_GROUP_NAME = 'Grupo WhatsApp';
const METADATA_ONLY_EVENTS = new Set([
  'SEND_MESSAGE',
  'CONTACTS_UPSERT',
  'CONTACTS_UPDATE',
  'CHATS_UPSERT',
  'CHATS_UPDATE',
  'GROUPS_UPSERT',
  'GROUP_UPDATE',
  'GROUP_PARTICIPANTS_UPDATE',
]);

function hasUsableGroupName(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized !== GENERIC_GROUP_NAME;
}

function isOpaqueDirectChatJid(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.includes('@g.us')) {
    return false;
  }

  return normalized.includes('@') && !normalized.endsWith('@s.whatsapp.net') && !normalized.endsWith('@c.us');
}

async function findAliasedActiveTicket(
  prisma: FastifyInstance['prisma'],
  params: {
    whatsappInstanceId: string;
    aliases: string[];
  },
) {
  if (params.aliases.length === 0) {
    return null;
  }

  const aliasRecord = await prisma.ticketChatAlias.findFirst({
    where: {
      whatsappInstanceId: params.whatsappInstanceId,
      alias: {
        in: params.aliases,
      },
      ticket: {
        status: {
          in: ['open', 'pending'],
        },
      },
    },
    include: {
      ticket: true,
    },
    orderBy: {
      lastSeenAt: 'desc',
    },
  });

  return aliasRecord?.ticket ?? null;
}

async function persistTicketAliases(
  tx: Prisma.TransactionClient,
  params: {
    whatsappInstanceId: string;
    ticketId: string;
    aliases: string[];
  },
) {
  for (const alias of params.aliases) {
    await tx.ticketChatAlias.upsert({
      where: {
        whatsappInstanceId_alias: {
          whatsappInstanceId: params.whatsappInstanceId,
          alias,
        },
      },
      create: {
        id: randomUUID(),
        whatsappInstanceId: params.whatsappInstanceId,
        ticketId: params.ticketId,
        alias,
        lastSeenAt: new Date(),
      },
      update: {
        ticketId: params.ticketId,
        lastSeenAt: new Date(),
      },
    });
  }
}

function pickObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickFirstNonEmptyString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function collectStringCandidates(value: unknown, depth = 0, seen = new WeakSet<object>()): string[] {
  if (depth > 6) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringCandidates(item, depth + 1, seen));
  }

  const record = pickObject(value);
  if (!record) {
    return typeof value === 'string' && value.trim().length > 0 ? [value.trim()] : [];
  }

  if (seen.has(record)) {
    return [];
  }

  seen.add(record);
  return Object.values(record).flatMap((child) => collectStringCandidates(child, depth + 1, seen));
}

function extractMetadataAliases(payload: Record<string, unknown>, parsed: ReturnType<typeof parseEvolutionPayload>) {
  const data = pickObject(payload.data);
  const rawCandidates = [
    parsed.remoteJid,
    ...(parsed.chatAliases ?? []),
    data?.remoteJid,
    data?.jid,
    data?.id,
    data?.chatId,
    data?.groupId,
    data?.conversation,
    data?.participant,
    data?.participantJid,
    data?.participantLid,
    data?.sender,
    data?.senderJid,
    data?.senderLid,
    data?.owner,
    data?.ownerJid,
    data?.ownerLid,
    data?.from,
    data?.to,
    pickObject(data?.key)?.remoteJid,
    pickObject(data?.key)?.participant,
    ...collectStringCandidates(data),
  ];

  return Array.from(new Set(
    rawCandidates
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && (value.includes('@') || value.startsWith('55'))),
  ));
}

function extractMetadataDisplayName(payload: Record<string, unknown>, parsed: ReturnType<typeof parseEvolutionPayload>) {
  const data = pickObject(payload.data);

  if (parsed.isGroup) {
    return pickFirstNonEmptyString([
      parsed.groupName,
      data?.subject,
      data?.groupSubject,
      data?.groupName,
      pickObject(data?.groupMetadata)?.subject,
      pickObject(data?.groupMetadata)?.name,
      pickObject(data?.groupInfo)?.subject,
      pickObject(data?.groupInfo)?.name,
    ]);
  }

  return pickFirstNonEmptyString([
    parsed.groupName,
    parsed.pushName,
    parsed.verifiedBizName,
    data?.subject,
    data?.groupSubject,
    data?.groupName,
    data?.formattedTitle,
    data?.title,
    data?.name,
    data?.notify,
    pickObject(data?.groupMetadata)?.subject,
    pickObject(data?.groupMetadata)?.name,
    pickObject(data?.groupInfo)?.subject,
    pickObject(data?.groupInfo)?.name,
    pickObject(data?.contact)?.name,
    pickObject(data?.contact)?.pushName,
    pickObject(data?.contact)?.notify,
    pickObject(data?.sender)?.name,
    pickObject(data?.sender)?.pushName,
    pickObject(data?.sender)?.notify,
  ]);
}

function resolveMetadataPhone(aliases: string[], parsedPhone: string | null) {
  if (parsedPhone) {
    return parsedPhone;
  }

  for (const alias of aliases) {
    const [localPart = ''] = alias.split('@');
    const baseLocalPart = localPart.split(':')[0]?.trim() ?? '';
    const normalized = normalizeTicketIdentityPhone(baseLocalPart);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

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
    const nextName = existing.isNameManuallySet || params.preserveExistingName ? existing.name : params.name;

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
    const normalizedCurrentName = typeof currentName === 'string' ? currentName.trim() : '';
    const hasSpecificCurrentName = normalizedCurrentName.length > 0 && normalizedCurrentName !== GENERIC_GROUP_NAME;
    const fallbackCurrentName = normalizedCurrentName.length > 0 ? normalizedCurrentName : null;

    return parsed.groupName
      ?? (hasSpecificCurrentName ? normalizedCurrentName : null)
      ?? fallbackCurrentName
      ?? GENERIC_GROUP_NAME;
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
  } else if (['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_EDITED', 'MESSAGES_DELETE', 'SEND_MESSAGE'].includes(event)) {
    // If the instance is exchanging message events, the WhatsApp session is alive.
    status = 'connected';
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

    if (METADATA_ONLY_EVENTS.has(parsed.event)) {
      const metadataAliases = extractMetadataAliases(params.payload, parsed);
      const metadataPhone = resolveMetadataPhone(metadataAliases, parsed.phone);
      const metadataIsGroup = metadataAliases.some((alias) => alias.includes('@g.us'));
      const metadataRemoteJid = parsed.remoteJid
        ?? metadataAliases.find((alias) => alias.includes('@g.us'))
        ?? metadataAliases.find((alias) => alias.endsWith('@s.whatsapp.net'))
        ?? metadataAliases.find((alias) => alias.endsWith('@c.us'))
        ?? metadataAliases.find((alias) => alias.includes('@'))
        ?? null;
      const metadataDisplayName = extractMetadataDisplayName(params.payload, parsed);
      const fetchedMetadataGroupName =
        metadataIsGroup
        && metadataRemoteJid
        && !hasUsableGroupName(metadataDisplayName)
          ? await fetchEvolutionGroupName({
              baseUrl: instance.baseUrl,
              apiKey: decryptedApiKey,
              instanceName: instance.evolutionInstanceName,
              remoteJid: metadataRemoteJid,
            }).then((response) => response.groupName).catch(() => null)
          : null;
      const resolvedMetadataDisplayName = fetchedMetadataGroupName ?? metadataDisplayName;

      if (metadataRemoteJid || metadataPhone || metadataAliases.length > 0) {
        const metadataIdentity = buildTicketChatIdentity({
          remoteJid: metadataRemoteJid,
          phone: metadataPhone,
          isGroup: metadataIsGroup,
          aliases: metadataAliases,
        });
        const metadataCanonicalChatId = metadataIdentity.canonicalChatId ?? metadataRemoteJid;
        const canPromoteMetadataChatId =
          metadataIsGroup
          || Boolean(metadataIdentity.contactId)
          || !isOpaqueDirectChatJid(metadataCanonicalChatId);
        const aliasCandidates = buildTicketAliasCandidates({
          remoteJid: metadataRemoteJid,
          canonicalChatId: metadataCanonicalChatId,
          contactId: metadataIdentity.contactId,
          aliases: metadataAliases,
        });

        const aliasedTicket = await findAliasedActiveTicket(app.prisma, {
          whatsappInstanceId: instance.id,
          aliases: aliasCandidates,
        });
        const existingTicket = aliasedTicket ?? (metadataCanonicalChatId
          ? await app.prisma.ticket.findFirst({
              where: buildActiveTicketIdentityWhere(instance.id, metadataIdentity),
              orderBy: {
                updatedAt: 'desc',
              },
            })
          : null);

        if (existingTicket) {
          await app.prisma.$transaction(async (tx) => {
            await persistTicketAliases(tx, {
              whatsappInstanceId: instance.id,
              ticketId: existingTicket.id,
              aliases: aliasCandidates,
            });

            if (resolvedMetadataDisplayName && (!metadataIsGroup || hasUsableGroupName(resolvedMetadataDisplayName))) {
              const lockedCustomer = existingTicket.customerId
                ? await tx.customer.findUnique({
                    where: { id: existingTicket.customerId },
                    select: { isNameManuallySet: true, name: true },
                  })
                : null;
              const nextSnapshot = lockedCustomer?.isNameManuallySet
                ? (lockedCustomer.name || existingTicket.customerNameSnapshot)
                : resolvedMetadataDisplayName;
              await tx.ticket.update({
                where: { id: existingTicket.id },
                data: {
                  customerNameSnapshot: nextSnapshot,
                  externalChatId: canPromoteMetadataChatId ? (metadataCanonicalChatId ?? existingTicket.externalChatId) : existingTicket.externalChatId,
                  externalContactId: metadataIdentity.contactId ?? existingTicket.externalContactId,
                  updatedAt: new Date(),
                },
              });
            } else if (metadataIdentity.contactId && metadataIdentity.contactId !== existingTicket.externalContactId) {
              await tx.ticket.update({
                where: { id: existingTicket.id },
                data: {
                  externalContactId: metadataIdentity.contactId,
                  updatedAt: new Date(),
                },
              });
            }
          });
        }
      }

      await finalize(202);
      return {
        statusCode: 202,
        body: {
          message: 'Evento de metadados processado.',
          event: parsed.event,
        },
      };
    }

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

    const preMatchedOutboundMessage = parsed.fromMe
      ? await app.prisma.ticketMessage.findFirst({
          where: {
            externalMessageId: parsed.externalMessageId,
            ticket: {
              whatsappInstanceId: instance.id,
            },
          },
          include: {
            ticket: true,
          },
        })
      : null;

    const resolvedRemoteJid = parsed.remoteJid ?? preMatchedOutboundMessage?.ticket.externalChatId;

    if (!resolvedRemoteJid) {
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

    const preliminaryChatIdentity = buildTicketChatIdentity({
      remoteJid: resolvedRemoteJid,
      phone: parsed.phone,
      isGroup: parsed.isGroup,
      aliases: parsed.chatAliases,
    });
    const preliminaryExternalChatId = preliminaryChatIdentity.canonicalChatId ?? resolvedRemoteJid;
    const preliminaryAliasCandidates = buildTicketAliasCandidates({
      remoteJid: resolvedRemoteJid,
      canonicalChatId: preliminaryExternalChatId,
      contactId: preliminaryChatIdentity.contactId,
      aliases: parsed.chatAliases,
    });
    const aliasedTicket = preMatchedOutboundMessage
      ? null
      : await findAliasedActiveTicket(app.prisma, {
          whatsappInstanceId: instance.id,
          aliases: preliminaryAliasCandidates,
        });

    if (
      !preMatchedOutboundMessage
      && !aliasedTicket
      && !parsed.isGroup
      && !parsed.phone
      && isOpaqueDirectChatJid(parsed.remoteJid)
    ) {
      app.log.warn({
        action: parsed.fromMe ? 'evolution_outbound_opaque_chat_ignored' : 'evolution_inbound_opaque_chat_ignored',
        event: parsed.event,
        instanceId: instance.id,
        externalMessageId: parsed.externalMessageId,
        remoteJid: parsed.remoteJid,
        direction: parsed.fromMe ? 'outbound' : 'inbound',
      }, 'Evento com identificador opaco ignorado para evitar criacao ou roteamento incorreto de ticket.');

      await finalize(202, 'Evento com identificador opaco ignorado.');
      return {
        statusCode: 202,
        body: {
          message: 'Evento com identificador opaco ignorado.',
          event: parsed.event,
          externalMessageId: parsed.externalMessageId,
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
    const fetchedGroupName = parsed.isGroup && !hasUsableGroupName(parsed.groupName)
      ? await fetchEvolutionGroupName({
          baseUrl: instance.baseUrl,
          apiKey: decryptedApiKey,
          instanceName: instance.evolutionInstanceName,
          remoteJid: resolvedRemoteJid,
        }).then((response) => response.groupName).catch(() => null)
      : null;
    const parsedWithResolvedGroupName = {
      ...parsed,
      groupName: fetchedGroupName ?? parsed.groupName,
    };
    const desiredCustomerName = resolveCustomerDisplayName(parsedWithResolvedGroupName);

    const customer = parsed.isGroup || !parsed.phone
      ? null
      : await findOrCreateCustomer(app.prisma, {
          name: desiredCustomerName,
          phoneE164: parsed.phone,
          avatarUrl: fetchedCustomerAvatarUrl,
          preserveExistingName: parsed.fromMe && !parsed.verifiedBizName,
        });
    const customerAvatarUrl = fetchedCustomerAvatarUrl ?? customer?.avatarUrl ?? null;
    const chatIdentity = preliminaryChatIdentity;
    const resolvedExternalChatId = preliminaryExternalChatId;
    const aliasCandidates = preliminaryAliasCandidates;
    const canPromoteResolvedChatId =
      parsed.isGroup
      || Boolean(chatIdentity.contactId)
      || !isOpaqueDirectChatJid(resolvedExternalChatId);

    const ticket = preMatchedOutboundMessage
      ? await app.prisma.ticket.update({
          where: { id: preMatchedOutboundMessage.ticket.id },
          data: {
            customerId: customer?.id ?? preMatchedOutboundMessage.ticket.customerId,
            customerNameSnapshot: resolveCustomerDisplayName(
              parsedWithResolvedGroupName,
              customer?.name ?? preMatchedOutboundMessage.ticket.customerNameSnapshot,
            ),
            customerAvatarUrl: customerAvatarUrl ?? preMatchedOutboundMessage.ticket.customerAvatarUrl,
            lastMessagePreview: parsed.body,
            unreadCount: 0,
            updatedAt: new Date(),
          },
        })
      : aliasedTicket
        ? await app.prisma.ticket.update({
            where: { id: aliasedTicket.id },
            data: {
              customerId: customer?.id ?? aliasedTicket.customerId,
              externalChatId: canPromoteResolvedChatId ? resolvedExternalChatId : aliasedTicket.externalChatId,
              externalContactId: chatIdentity.contactId ?? aliasedTicket.externalContactId,
              customerNameSnapshot: resolveCustomerDisplayName(
                parsedWithResolvedGroupName,
                customer?.name ?? aliasedTicket.customerNameSnapshot,
              ),
              customerAvatarUrl: customerAvatarUrl ?? aliasedTicket.customerAvatarUrl,
              lastMessagePreview: parsed.body,
              unreadCount: parsed.fromMe ? 0 : { increment: 1 },
              status: parsed.fromMe ? aliasedTicket.status : aliasedTicket.currentAgentId ? aliasedTicket.status : 'pending',
              updatedAt: new Date(),
            },
          })
      : await withTicketIdentityLock(app.prisma, {
          whatsappInstanceId: instance.id,
          canonicalChatId: resolvedExternalChatId,
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
                externalChatId: resolvedExternalChatId,
                externalContactId: chatIdentity.contactId,
                customerNameSnapshot: resolveCustomerDisplayName(parsedWithResolvedGroupName, customer?.name),
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
              externalChatId: canPromoteResolvedChatId ? (chatIdentity.canonicalChatId ?? existingTicket.externalChatId) : existingTicket.externalChatId,
              externalContactId: chatIdentity.contactId ?? existingTicket.externalContactId,
              customerNameSnapshot: resolveCustomerDisplayName(parsedWithResolvedGroupName, customer?.name ?? existingTicket.customerNameSnapshot),
              customerAvatarUrl: customerAvatarUrl ?? existingTicket.customerAvatarUrl,
              lastMessagePreview: parsed.body,
              unreadCount: parsed.fromMe ? 0 : { increment: 1 },
              status: parsed.fromMe ? existingTicket.status : existingTicket.currentAgentId ? existingTicket.status : 'pending',
              updatedAt: new Date(),
            },
          });
        });

    await app.prisma.$transaction(async (tx) => {
      await persistTicketAliases(tx, {
        whatsappInstanceId: instance.id,
        ticketId: ticket.id,
        aliases: aliasCandidates,
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
