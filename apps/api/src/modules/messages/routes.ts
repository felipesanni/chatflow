import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { requirePermission } from '../../lib/auth-guard.js';
import { sendEvolutionAudio, sendEvolutionDeleteMessage, sendEvolutionMedia, sendEvolutionReaction, sendEvolutionText, sendEvolutionUpdateMessage } from '../../lib/evolution-client.js';
import { loadEnv } from '../../config/env.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';
import type { PermissionMap } from '../../lib/permissions.js';

const outgoingAttachmentSchema = z.object({
  kind: z.enum(['image', 'audio', 'document']),
  fileName: z.string().trim().min(1, 'Informe o nome do arquivo.'),
  mimeType: z.string().trim().min(1, 'Informe o tipo do arquivo.'),
  dataUrl: z.string().trim().min(1, 'Informe o conteudo do arquivo.'),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const createMessageBodySchema = z.object({
  body: z.string().trim().optional().default(''),
  replyToMessageId: z.string().uuid().optional(),
  attachment: outgoingAttachmentSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.body.trim() && !value.attachment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe uma mensagem ou anexe um arquivo para enviar.',
      path: ['body'],
    });
  }
});

const updateMessageBodySchema = z.object({
  body: z.string().trim().min(1, 'Informe o novo texto da mensagem.'),
});

const createReactionBodySchema = z.object({
  emoji: z.string().trim().min(1, 'Informe a reação.').max(16, 'Reação inválida.'),
});

const env = loadEnv();

function parseDataUrl(input: string) {
  const match = input.match(/^data:([^,]+),(.+)$/);

  if (!match) {
    throw new Error('Arquivo em formato invalido.');
  }

  const metadata = match[1] ?? '';
  const mimeType = metadata.split(';')[0] ?? 'application/octet-stream';

  if (!metadata.includes(';base64')) {
    throw new Error('Arquivo em formato invalido.');
  }

  return {
    mimeType,
    base64: match[2] ?? '',
  };
}

function normalizeSizeBytes(value: unknown) {
  if (typeof value === 'bigint') {
    const normalized = Number(value);
    return Number.isSafeInteger(normalized) ? normalized : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function pickDeliveryMessageId(payload: any, fallback: string) {
  return payload?.key?.id
    ?? payload?.message?.key?.id
    ?? payload?.data?.key?.id
    ?? payload?.data?.message?.key?.id
    ?? fallback;
}

function pickAttachmentPublicUrl(payload: any) {
  return payload?.url
    ?? payload?.data?.url
    ?? payload?.message?.imageMessage?.url
    ?? payload?.message?.documentMessage?.url
    ?? payload?.message?.audioMessage?.url
    ?? payload?.data?.message?.imageMessage?.url
    ?? payload?.data?.message?.documentMessage?.url
    ?? payload?.data?.message?.audioMessage?.url
    ?? null;
}

function resolveExternalAttachmentUrl(baseUrl: string, candidate: string | null) {
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('data:')) {
    return candidate;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    return new URL(candidate.replace(/^\.\//, ''), `${baseUrl.replace(/\/$/, '')}/`).toString();
  }
}

function canViewTicket(viewerId: string, permissions: PermissionMap, ticket: { currentAgentId: string | null }) {
  if (permissions['tickets.viewAll']) {
    return true;
  }

  return ticket.currentAgentId === null || ticket.currentAgentId === viewerId;
}

function canReplyToTicket(viewerId: string, ticket: { currentAgentId: string | null }) {
  return ticket.currentAgentId === viewerId;
}

function formatAgentSignedBody(agentName: string, body: string) {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return '';
  }

  return `*${agentName}*\n\n${trimmedBody}`;
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

    return [{
      emoji,
      actorType: record.actorType === 'agent' ? 'agent' : 'contact',
      actorId: typeof record.actorId === 'string' ? record.actorId : null,
      actorName: typeof record.actorName === 'string' ? record.actorName : null,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    }];
  });
}

function serializeMessageReactions(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return [];
  }

  return normalizeStoredReactions((rawPayload as Record<string, unknown>).chatflowReactions);
}

function serializeDeletedState(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return null;
  }

  const deleted = (rawPayload as Record<string, unknown>).chatflowDeleted;
  if (!deleted || typeof deleted !== 'object' || Array.isArray(deleted)) {
    return null;
  }

  const record = deleted as Record<string, unknown>;
  if (record.isDeleted !== true) {
    return null;
  }

  return {
    isDeleted: true,
    deletedAt: typeof record.deletedAt === 'string' ? record.deletedAt : null,
    scope: typeof record.scope === 'string' ? record.scope : null,
  };
}

function normalizeHiddenForUserIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.flatMap((item) => typeof item === 'string' && item.trim().length > 0 ? [item.trim()] : []);
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
    ...current.filter((item) => !(item.actorType === reaction.actorType && item.actorId === reaction.actorId)),
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

function withMessageHiddenForUser(rawPayload: Prisma.JsonValue | null | undefined, userId: string) {
  const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};

  const current = normalizeHiddenForUserIds(payload.chatflowHiddenForUserIds);
  payload.chatflowHiddenForUserIds = Array.from(new Set([...current, userId]));
  return payload as Prisma.InputJsonValue;
}

export const messageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tickets/:ticketId/attachments/:attachmentId/content', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      ticketId: z.string().uuid(),
      attachmentId: z.string().uuid(),
    }).parse(request.params);

    const attachment = await app.prisma.attachment.findFirst({
      where: {
        id: params.attachmentId,
        message: {
          ticketId: params.ticketId,
        },
      },
      include: {
        message: {
          include: {
            ticket: {
              include: {
                whatsappInstance: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      return reply.notFound('Anexo nao encontrado.');
    }

    if (!canViewTicket(session.userId, access.permissions, attachment.message.ticket)) {
      return reply.forbidden('Voce nao possui permissao para visualizar este ticket.');
    }

    const source = attachment.publicUrl ?? attachment.storageKey;
    if (!source) {
      return reply.notFound('Conteudo do anexo indisponivel.');
    }

    if (source.startsWith('data:')) {
      const parsed = parseDataUrl(source);
      reply.header('Content-Type', parsed.mimeType || attachment.mimeType);
      reply.header('Cache-Control', 'private, max-age=300');
      return reply.send(Buffer.from(parsed.base64, 'base64'));
    }

    const decryptedApiKey = decryptSecret(attachment.message.ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);
    const targetUrl = resolveExternalAttachmentUrl(attachment.message.ticket.whatsappInstance.baseUrl, source);
    const requestedRange = Array.isArray(request.headers.range) ? request.headers.range[0] : request.headers.range;

    if (!targetUrl) {
      return reply.notFound('Conteudo do anexo indisponivel.');
    }

    const mediaResponse = await fetch(targetUrl, {
      headers: {
        apikey: decryptedApiKey,
        ...(requestedRange ? { range: requestedRange } : {}),
      },
    });

    if (!mediaResponse.ok) {
      return reply.code(mediaResponse.status).send({
        message: 'Falha ao carregar o anexo externo.',
      });
    }

    const arrayBuffer = await mediaResponse.arrayBuffer();
    const contentType = mediaResponse.headers.get('content-type') ?? attachment.mimeType;
    const contentLength = mediaResponse.headers.get('content-length');
    const acceptRanges = mediaResponse.headers.get('accept-ranges');
    const contentRange = mediaResponse.headers.get('content-range');
    const contentDisposition = attachment.fileName
      ? `inline; filename="${encodeURIComponent(attachment.fileName)}"`
      : undefined;

    reply.code(mediaResponse.status);
    reply.header('Content-Type', contentType);
    reply.header('Cache-Control', 'private, max-age=300');
    if (contentLength) {
      reply.header('Content-Length', contentLength);
    }
    if (acceptRanges) {
      reply.header('Accept-Ranges', acceptRanges);
    }
    if (contentRange) {
      reply.header('Content-Range', contentRange);
    }
    if (contentDisposition) {
      reply.header('Content-Disposition', contentDisposition);
    }

    return reply.send(Buffer.from(arrayBuffer));
  });

  app.get('/tickets/:ticketId/messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: { id: true, currentAgentId: true },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canViewTicket(session.userId, access.permissions, ticket)) {
      return reply.forbidden('Voce nao possui permissao para visualizar este ticket.');
    }

    const items = await app.prisma.ticketMessage.findMany({
      where: { ticketId: params.ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        senderAgent: true,
        attachments: true,
        replyToMessage: {
          include: {
            attachments: true,
          },
        },
      },
    });

    return {
      items: items
        .filter((message: any) => !normalizeHiddenForUserIds(message.rawPayload?.chatflowHiddenForUserIds).includes(session.userId))
        .map((message: any) => ({
        id: message.id,
        ticketId: message.ticketId,
        direction: message.direction,
        contentType: message.contentType,
        body: message.body,
        senderName: message.senderNameSnapshot,
        externalMessageId: message.externalMessageId,
        editedAt: message.editedAt,
        createdAt: message.createdAt,
        reactions: serializeMessageReactions(message.rawPayload),
        deleted: serializeDeletedState(message.rawPayload),
        hiddenForMe: normalizeHiddenForUserIds(message.rawPayload?.chatflowHiddenForUserIds).includes(session.userId),
        replyToMessage: message.replyToMessage
          ? {
              id: message.replyToMessage.id,
              direction: message.replyToMessage.direction,
              contentType: message.replyToMessage.contentType,
              body: message.replyToMessage.body,
              senderName: message.replyToMessage.senderNameSnapshot,
              createdAt: message.replyToMessage.createdAt,
              deleted: serializeDeletedState(message.replyToMessage.rawPayload),
              hiddenForMe: normalizeHiddenForUserIds(message.replyToMessage.rawPayload?.chatflowHiddenForUserIds).includes(session.userId),
              attachments: message.replyToMessage.attachments.map((attachment: any) => ({
                id: attachment.id,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                sizeBytes: normalizeSizeBytes(attachment.sizeBytes),
                storage: attachment.storage,
                storageKey: attachment.storageKey,
                publicUrl: attachment.publicUrl,
                createdAt: attachment.createdAt,
              })),
            }
          : null,
        senderAgent: message.senderAgent ? { id: message.senderAgent.id, name: message.senderAgent.name } : null,
        attachments: message.attachments.map((attachment: any) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: normalizeSizeBytes(attachment.sizeBytes),
          storage: attachment.storage,
          storageKey: attachment.storageKey,
          publicUrl: attachment.publicUrl,
          createdAt: attachment.createdAt,
        })),
      })),
      viewer: {
        id: session.userId,
        role: session.role,
      },
    };
  });

  app.patch('/tickets/:ticketId/messages/:messageId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      ticketId: z.string().uuid(),
      messageId: z.string().uuid(),
    }).parse(request.params);
    const body = updateMessageBodySchema.parse(request.body);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
        whatsappInstance: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canReplyToTicket(session.userId, ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode editar mensagens deste ticket.');
    }

    if (!ticket.externalChatId) {
      return reply.badRequest('O ticket nao possui um destino do WhatsApp configurado.');
    }

    const message = await app.prisma.ticketMessage.findFirst({
      where: {
        id: params.messageId,
        ticketId: params.ticketId,
      },
      include: {
        attachments: true,
      },
    });

    if (!message) {
      return reply.notFound('Mensagem nao encontrada.');
    }

    if (message.direction !== 'outbound') {
      return reply.badRequest('Somente mensagens enviadas podem ser editadas.');
    }

    if (message.attachments.length > 0 || message.contentType !== 'text') {
      return reply.badRequest('Somente mensagens de texto sem anexos podem ser editadas.');
    }

    if (!message.externalMessageId) {
      return reply.badRequest('A mensagem nao possui identificador externo para edicao.');
    }

    const agentSignature = ticket.currentAgent?.name ?? message.senderNameSnapshot ?? session.email;
    const signedBody = formatAgentSignedBody(agentSignature, body.body);

    const decryptedApiKey = decryptSecret(ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);
    const delivery = await sendEvolutionUpdateMessage({
      baseUrl: ticket.whatsappInstance.baseUrl,
      apiKey: decryptedApiKey,
      instanceName: ticket.whatsappInstance.evolutionInstanceName,
      remoteJid: ticket.externalChatId,
      externalMessageId: message.externalMessageId,
      text: signedBody,
    });

    if (!delivery.ok) {
      return reply.code(400).send({
        message: 'Falha ao editar a mensagem na Evolution API.',
        status: delivery.status,
        payload: delivery.payload,
      });
    }

    const updatedMessage = await app.prisma.ticketMessage.update({
      where: { id: message.id },
      data: {
        body: signedBody,
        editedAt: new Date(),
      },
    });

    const latestMessage = await app.prisma.ticketMessage.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (latestMessage?.id === message.id) {
      await app.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          lastMessagePreview: body.body.trim(),
        },
      });

      app.io.emit('ticket.updated', {
        ticketId: ticket.id,
        lastMessagePreview: body.body.trim(),
        unreadCount: ticket.unreadCount,
      });
    }

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'message_out',
        actorUserId: session.userId,
        metadata: {
          messageId: updatedMessage.id,
          externalMessageId: updatedMessage.externalMessageId,
          contentType: updatedMessage.contentType,
          edited: true,
        },
      },
    });

    app.io.emit('message.updated', {
      ticketId: ticket.id,
      messageId: updatedMessage.id,
      direction: updatedMessage.direction,
    });

    return {
      item: {
        id: updatedMessage.id,
        ticketId: updatedMessage.ticketId,
        direction: updatedMessage.direction,
        contentType: updatedMessage.contentType,
        body: updatedMessage.body,
        senderName: updatedMessage.senderNameSnapshot,
        externalMessageId: updatedMessage.externalMessageId,
        editedAt: updatedMessage.editedAt,
        createdAt: updatedMessage.createdAt,
        reactions: serializeMessageReactions(updatedMessage.rawPayload),
        deleted: serializeDeletedState(updatedMessage.rawPayload),
      },
    };
  });

  app.post('/tickets/:ticketId/messages/:messageId/reactions', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      ticketId: z.string().uuid(),
      messageId: z.string().uuid(),
    }).parse(request.params);
    const body = createReactionBodySchema.parse(request.body);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
        whatsappInstance: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canReplyToTicket(session.userId, ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode reagir neste ticket.');
    }

    const message = await app.prisma.ticketMessage.findFirst({
      where: {
        id: params.messageId,
        ticketId: params.ticketId,
      },
    });

    if (!message) {
      return reply.notFound('Mensagem nao encontrada.');
    }

    if (!message.externalMessageId) {
      return reply.badRequest('A mensagem nao possui identificador externo para reação.');
    }

    const decryptedApiKey = decryptSecret(ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);
    const delivery = await sendEvolutionReaction({
      baseUrl: ticket.whatsappInstance.baseUrl,
      apiKey: decryptedApiKey,
      instanceName: ticket.whatsappInstance.evolutionInstanceName,
      remoteJid: ticket.externalChatId,
      externalMessageId: message.externalMessageId,
      emoji: body.emoji,
      fromMe: message.direction === 'outbound',
    });

    if (!delivery.ok) {
      return reply.code(400).send({
        message: 'Falha ao enviar a reação para a Evolution API.',
        status: delivery.status,
        payload: delivery.payload,
      });
    }

    const updatedMessage = await app.prisma.ticketMessage.update({
      where: { id: message.id },
      data: {
        rawPayload: withStoredReaction(message.rawPayload, {
          emoji: body.emoji,
          actorType: 'agent',
          actorId: session.userId,
          actorName: ticket.currentAgent?.name ?? session.email,
        }),
      },
    });

    app.io.emit('message.updated', {
      ticketId: ticket.id,
      messageId: updatedMessage.id,
      direction: updatedMessage.direction,
    });

    return reply.code(201).send({
      item: {
        id: updatedMessage.id,
        reactions: serializeMessageReactions(updatedMessage.rawPayload),
        deleted: serializeDeletedState(updatedMessage.rawPayload),
      },
    });
  });

  app.post('/tickets/:ticketId/messages/:messageId/delete', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      ticketId: z.string().uuid(),
      messageId: z.string().uuid(),
    }).parse(request.params);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
        whatsappInstance: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canReplyToTicket(session.userId, ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode apagar mensagens neste ticket.');
    }

    const message = await app.prisma.ticketMessage.findFirst({
      where: {
        id: params.messageId,
        ticketId: params.ticketId,
      },
    });

    if (!message) {
      return reply.notFound('Mensagem nao encontrada.');
    }

    if (message.direction !== 'outbound') {
      return reply.badRequest('Somente mensagens enviadas podem ser apagadas para todos.');
    }

    if (!message.externalMessageId) {
      return reply.badRequest('A mensagem nao possui identificador externo para exclusao.');
    }

    const decryptedApiKey = decryptSecret(ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);
    const delivery = await sendEvolutionDeleteMessage({
      baseUrl: ticket.whatsappInstance.baseUrl,
      apiKey: decryptedApiKey,
      instanceName: ticket.whatsappInstance.evolutionInstanceName,
      remoteJid: ticket.externalChatId,
      externalMessageId: message.externalMessageId,
    });

    if (!delivery.ok) {
      return reply.code(400).send({
        message: 'Falha ao apagar a mensagem na Evolution API.',
        status: delivery.status,
        payload: delivery.payload,
      });
    }

    const updatedMessage = await app.prisma.ticketMessage.update({
      where: { id: message.id },
      data: {
        rawPayload: withDeletedMessage(message.rawPayload),
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'message_out',
        actorUserId: session.userId,
        metadata: {
          messageId: updatedMessage.id,
          externalMessageId: updatedMessage.externalMessageId,
          contentType: updatedMessage.contentType,
          deleted: true,
        },
      },
    });

    app.io.emit('message.updated', {
      ticketId: ticket.id,
      messageId: updatedMessage.id,
      direction: updatedMessage.direction,
    });

    return reply.code(201).send({
      item: {
        id: updatedMessage.id,
        deleted: serializeDeletedState(updatedMessage.rawPayload),
      },
    });
  });

  app.post('/tickets/:ticketId/messages/:messageId/delete-local', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      ticketId: z.string().uuid(),
      messageId: z.string().uuid(),
    }).parse(request.params);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: {
        id: true,
        currentAgentId: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canViewTicket(session.userId, access.permissions, ticket)) {
      return reply.forbidden('Voce nao possui permissao para visualizar este ticket.');
    }

    const message = await app.prisma.ticketMessage.findFirst({
      where: {
        id: params.messageId,
        ticketId: params.ticketId,
      },
    });

    if (!message) {
      return reply.notFound('Mensagem nao encontrada.');
    }

    const updatedMessage = await app.prisma.ticketMessage.update({
      where: { id: message.id },
      data: {
        rawPayload: withMessageHiddenForUser(message.rawPayload, session.userId),
      },
    });

    app.io.emit('message.updated', {
      ticketId: ticket.id,
      messageId: updatedMessage.id,
      direction: updatedMessage.direction,
    });

    return reply.code(201).send({
      item: {
        id: updatedMessage.id,
        hiddenForMe: true,
      },
    });
  });

  app.post('/tickets/:ticketId/messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const body = createMessageBodySchema.parse(request.body);
    const trimmedBody = body.body.trim();

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
        whatsappInstance: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canReplyToTicket(session.userId, ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode responder este ticket.');
    }

    if (!ticket.externalChatId) {
      return reply.badRequest('O ticket nao possui um destino do WhatsApp configurado.');
    }

    const quotedMessage = body.replyToMessageId
      ? await app.prisma.ticketMessage.findUnique({ where: { id: body.replyToMessageId } })
      : null;

    const decryptedApiKey = decryptSecret(ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);

    if (!ticket.whatsappInstance.apiKeyEncrypted.startsWith('enc:')) {
      await app.prisma.whatsAppInstance.update({
        where: { id: ticket.whatsappInstance.id },
        data: {
          apiKeyEncrypted: encryptSecret(decryptedApiKey, env.SESSION_SECRET),
        },
      });
    }

    const attachmentInput = body.attachment;
    const parsedAttachment = attachmentInput ? parseDataUrl(attachmentInput.dataUrl) : null;
    const agentSignature = ticket.currentAgent?.name ?? session.email;
    const signedBody = trimmedBody ? formatAgentSignedBody(agentSignature, trimmedBody) : '';

    const delivery = attachmentInput
      ? attachmentInput.kind === 'audio'
        ? await sendEvolutionAudio({
            baseUrl: ticket.whatsappInstance.baseUrl,
            apiKey: decryptedApiKey,
            instanceName: ticket.whatsappInstance.evolutionInstanceName,
            remoteJid: ticket.externalChatId,
            base64: parsedAttachment?.base64 ?? '',
            quotedMessageId: quotedMessage?.externalMessageId ?? undefined,
          })
        : await sendEvolutionMedia({
            baseUrl: ticket.whatsappInstance.baseUrl,
            apiKey: decryptedApiKey,
            instanceName: ticket.whatsappInstance.evolutionInstanceName,
            remoteJid: ticket.externalChatId,
            mediaType: attachmentInput.kind === 'image' ? 'image' : 'document',
            fileName: attachmentInput.fileName,
            mimeType: attachmentInput.mimeType || parsedAttachment?.mimeType || 'application/octet-stream',
            base64: parsedAttachment?.base64 ?? '',
            caption: signedBody || undefined,
            quotedMessageId: quotedMessage?.externalMessageId ?? undefined,
          })
      : await sendEvolutionText({
          baseUrl: ticket.whatsappInstance.baseUrl,
          apiKey: decryptedApiKey,
          instanceName: ticket.whatsappInstance.evolutionInstanceName,
          remoteJid: ticket.externalChatId,
          text: signedBody,
          quotedMessageId: quotedMessage?.externalMessageId ?? undefined,
        });

    if (!delivery.ok) {
      return reply.code(400).send({
        message: 'Falha ao enviar a mensagem para a Evolution API.',
        status: delivery.status,
        payload: delivery.payload,
      });
    }

    const message = await app.prisma.ticketMessage.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        senderAgentId: session.userId,
        externalMessageId: pickDeliveryMessageId(delivery.payload, delivery.messageId),
        direction: 'outbound',
        contentType: attachmentInput?.kind ?? 'text',
        body: signedBody || (attachmentInput ? `[${attachmentInput.kind}] ${attachmentInput.fileName}` : null),
        senderNameSnapshot: ticket.currentAgent?.name ?? session.email,
        replyToMessageId: body.replyToMessageId,
        deliveredAt: new Date(),
      },
    });

    if (attachmentInput) {
      const fallbackPublicUrl = attachmentInput.kind === 'image' || attachmentInput.kind === 'audio'
        ? attachmentInput.dataUrl
        : null;
      const resolvedPublicUrl = pickAttachmentPublicUrl(delivery.payload) ?? fallbackPublicUrl;

      await app.prisma.attachment.create({
        data: {
          id: randomUUID(),
          messageId: message.id,
          fileName: attachmentInput.fileName,
          mimeType: attachmentInput.mimeType || parsedAttachment?.mimeType || 'application/octet-stream',
          sizeBytes: normalizeSizeBytes(attachmentInput.sizeBytes),
          storage: 'external',
          storageKey: resolvedPublicUrl ?? `outbound:${message.id}:${attachmentInput.fileName}`,
          publicUrl: resolvedPublicUrl,
        },
      });
    }

    await app.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lastMessagePreview: trimmedBody || (attachmentInput ? `[${attachmentInput.kind}] ${attachmentInput.fileName}` : null),
        unreadCount: 0,
        status: 'open',
        currentAgentId: ticket.currentAgentId ?? session.userId,
        updatedAt: new Date(),
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'message_out',
        actorUserId: session.userId,
        metadata: {
          messageId: message.id,
          externalMessageId: pickDeliveryMessageId(delivery.payload, delivery.messageId),
          contentType: attachmentInput?.kind ?? 'text',
          attachmentName: attachmentInput?.fileName ?? null,
        },
      },
    });

    app.io.emit('message.created', {
      ticketId: ticket.id,
      messageId: message.id,
      direction: message.direction,
    });

    app.io.emit('ticket.updated', {
      ticketId: ticket.id,
      lastMessagePreview: trimmedBody || (attachmentInput ? `[${attachmentInput.kind}] ${attachmentInput.fileName}` : null),
      unreadCount: 0,
    });

    return reply.code(201).send({ item: message });
  });
};
