import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';
import { sendEvolutionAudio, sendEvolutionMedia, sendEvolutionText } from '../../lib/evolution-client.js';
import { loadEnv } from '../../config/env.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';

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

const env = loadEnv();

function parseDataUrl(input: string) {
  const match = input.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Arquivo em formato invalido.');
  }

  return {
    mimeType: match[1] ?? 'application/octet-stream',
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

export const messageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tickets/:ticketId/messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const items = await app.prisma.ticketMessage.findMany({
      where: { ticketId: params.ticketId },
      orderBy: { createdAt: 'asc' },
      include: { senderAgent: true, attachments: true },
    });

    return {
      items: items.map((message: any) => ({
        id: message.id,
        ticketId: message.ticketId,
        direction: message.direction,
        contentType: message.contentType,
        body: message.body,
        senderName: message.senderNameSnapshot,
        externalMessageId: message.externalMessageId,
        createdAt: message.createdAt,
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
            caption: trimmedBody || undefined,
            quotedMessageId: quotedMessage?.externalMessageId ?? undefined,
          })
      : await sendEvolutionText({
          baseUrl: ticket.whatsappInstance.baseUrl,
          apiKey: decryptedApiKey,
          instanceName: ticket.whatsappInstance.evolutionInstanceName,
          remoteJid: ticket.externalChatId,
          text: trimmedBody,
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
        body: trimmedBody || (attachmentInput ? `[${attachmentInput.kind}] ${attachmentInput.fileName}` : null),
        senderNameSnapshot: ticket.currentAgent?.name ?? session.email,
        replyToMessageId: body.replyToMessageId,
        deliveredAt: new Date(),
      },
    });

    if (attachmentInput) {
      await app.prisma.attachment.create({
        data: {
          id: randomUUID(),
          messageId: message.id,
          fileName: attachmentInput.fileName,
          mimeType: attachmentInput.mimeType || parsedAttachment?.mimeType || 'application/octet-stream',
          sizeBytes: normalizeSizeBytes(attachmentInput.sizeBytes),
          storage: 'external',
          storageKey: pickAttachmentPublicUrl(delivery.payload) ?? `outbound:${message.id}:${attachmentInput.fileName}`,
          publicUrl: pickAttachmentPublicUrl(delivery.payload),
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
