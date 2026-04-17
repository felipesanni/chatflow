import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { sendEvolutionAudio, sendEvolutionMedia, sendEvolutionText } from './evolution-client.js';
import { loadEnv } from '../config/env.js';
import { decryptSecret, encryptSecret } from './secrets.js';

const env = loadEnv();

export type OutgoingAttachmentInput = {
  kind: 'image' | 'audio' | 'document';
  fileName: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes?: number;
};

type DeliverOutboundMessageParams = {
  ticketId: string;
  actorUserId: string;
  body?: string;
  replyToMessageId?: string | null;
  attachment?: OutgoingAttachmentInput | null;
  internalNote?: boolean;
  preserveCurrentAgent?: boolean;
  preserveCurrentStatus?: boolean;
  suppressSignature?: boolean;
};

type MessageTemplateContext = {
  ticket: {
    id: string;
    status: string;
    customerNameSnapshot: string;
    title: string | null;
    externalContactId: string | null;
    isGroup: boolean;
    currentAgent: { name: string } | null;
    currentQueue: { name: string } | null;
    whatsappInstance: { name: string };
  };
  actor: {
    email: string;
    agent: { name: string | null } | null;
  };
};

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

function formatAgentSignedBody(agentName: string, body: string) {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return '';
  }

  return `*${agentName}*\n${trimmedBody}`;
}

function shouldSignOutboundBody(params: {
  isInternalNote: boolean;
  isGroup: boolean;
  actorIsBotAgent: boolean;
  suppressSignature: boolean;
}) {
  if (params.suppressSignature) {
    return false;
  }

  if (params.isInternalNote) {
    return false;
  }

  if (params.isGroup) {
    return false;
  }

  if (params.actorIsBotAgent) {
    return false;
  }

  return true;
}

function withInternalNote(rawPayload: Prisma.JsonValue | null | undefined) {
  const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};

  payload.chatflowInternalNote = true;
  return payload as Prisma.InputJsonValue;
}

function resolveTemplateCustomerName(context: MessageTemplateContext) {
  const groupName = context.ticket.title?.trim();
  if (context.ticket.isGroup && groupName) {
    return groupName;
  }

  return context.ticket.customerNameSnapshot.trim();
}

function resolveTemplateFirstName(customerName: string) {
  const [firstName = ''] = customerName.split(/\s+/);
  return firstName.trim();
}

function resolveTemplateAgentName(context: MessageTemplateContext) {
  return context.ticket.currentAgent?.name?.trim()
    || context.actor.agent?.name?.trim()
    || context.actor.email.trim();
}

export function renderMessageTemplate(template: string, context: MessageTemplateContext) {
  if (!template.includes('{{')) {
    return template;
  }

  const customerName = resolveTemplateCustomerName(context);
  const firstName = resolveTemplateFirstName(customerName);
  const replacements: Record<string, string> = {
    customerName,
    firstName,
    phone: context.ticket.externalContactId?.trim() ?? '',
    agentName: resolveTemplateAgentName(context),
    queueName: context.ticket.currentQueue?.name?.trim() ?? '',
    instanceName: context.ticket.whatsappInstance.name.trim(),
    ticketId: context.ticket.id,
    ticketStatus: context.ticket.status,
  };

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, token: string) => replacements[token] ?? '');
}

export async function deliverOutboundMessage(app: FastifyInstance, params: DeliverOutboundMessageParams) {
  const ticket = await app.prisma.ticket.findUnique({
    where: { id: params.ticketId },
    include: {
      currentAgent: true,
      currentQueue: true,
      whatsappInstance: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket nao encontrado.');
  }

  const actor = await app.prisma.user.findUnique({
    where: { id: params.actorUserId },
    select: {
      id: true,
      email: true,
      agent: {
        select: {
          id: true,
          name: true,
          isBotAgent: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error('Usuario responsavel nao encontrado.');
  }

  const renderedBody = renderMessageTemplate(params.body ?? '', {
    ticket: {
      id: ticket.id,
      status: ticket.status,
      customerNameSnapshot: ticket.customerNameSnapshot,
      title: ticket.title,
      externalContactId: ticket.externalContactId,
      isGroup: ticket.isGroup,
      currentAgent: ticket.currentAgent ? { name: ticket.currentAgent.name } : null,
      currentQueue: ticket.currentQueue ? { name: ticket.currentQueue.name } : null,
      whatsappInstance: { name: ticket.whatsappInstance.name },
    },
    actor: {
      email: actor.email,
      agent: actor.agent ? { name: actor.agent.name } : null,
    },
  });
  const trimmedBody = renderedBody.trim();
  const attachmentInput = params.attachment ?? null;
  const isInternalNote = params.internalNote === true;

  if (!trimmedBody && !attachmentInput) {
    throw new Error('Informe uma mensagem ou anexe um arquivo para enviar.');
  }

  if (isInternalNote && attachmentInput) {
    throw new Error('Observacoes internas nao aceitam anexos.');
  }

  if (!isInternalNote && !ticket.externalChatId) {
    throw new Error('O ticket nao possui um destino do WhatsApp configurado.');
  }

  const quotedMessage = params.replyToMessageId
    ? await app.prisma.ticketMessage.findUnique({ where: { id: params.replyToMessageId } })
    : null;

  const actorName = actor.agent?.name ?? actor.email;
  const signedBody = shouldSignOutboundBody({
    isInternalNote,
    isGroup: ticket.isGroup,
    actorIsBotAgent: actor.agent?.isBotAgent === true,
    suppressSignature: params.suppressSignature === true,
  })
    ? (trimmedBody ? formatAgentSignedBody(actorName, trimmedBody) : '')
    : trimmedBody;

  const parsedAttachment = attachmentInput ? parseDataUrl(attachmentInput.dataUrl) : null;

  let externalMessageId: string | null = null;
  let deliveryPayload: any = null;

  if (!isInternalNote) {
    const decryptedApiKey = decryptSecret(ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);

    if (!ticket.whatsappInstance.apiKeyEncrypted.startsWith('enc:')) {
      await app.prisma.whatsAppInstance.update({
        where: { id: ticket.whatsappInstance.id },
        data: {
          apiKeyEncrypted: encryptSecret(decryptedApiKey, env.SESSION_SECRET),
        },
      });
    }

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
      const error = new Error('Falha ao enviar a mensagem para a Evolution API.');
      (error as Error & { cause?: unknown }).cause = {
        status: delivery.status,
        payload: delivery.payload,
      };
      throw error;
    }

    deliveryPayload = delivery.payload;
    externalMessageId = pickDeliveryMessageId(delivery.payload, delivery.messageId);
  }

  const message = await app.prisma.ticketMessage.create({
    data: {
      id: randomUUID(),
      ticketId: ticket.id,
      senderAgentId: actor.agent?.id ?? null,
      externalMessageId,
      direction: 'outbound',
      contentType: attachmentInput?.kind ?? 'text',
      body: signedBody || (attachmentInput ? `[${attachmentInput.kind}] ${attachmentInput.fileName}` : null),
      senderNameSnapshot: actorName,
      replyToMessageId: params.replyToMessageId ?? null,
      deliveredAt: isInternalNote ? null : new Date(),
      rawPayload: isInternalNote ? withInternalNote(null) : undefined,
    },
  });

  if (attachmentInput && !isInternalNote) {
    const fallbackPublicUrl = attachmentInput.kind === 'image' || attachmentInput.kind === 'audio'
      ? attachmentInput.dataUrl
      : null;
    const resolvedPublicUrl = pickAttachmentPublicUrl(deliveryPayload) ?? fallbackPublicUrl;

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

  const preview = isInternalNote
    ? `Observacao: ${trimmedBody}`
    : (trimmedBody || (attachmentInput ? `[${attachmentInput.kind}] ${attachmentInput.fileName}` : null));

  await app.prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      lastMessagePreview: preview,
      lastMessageAt: message.createdAt,
      unreadCount: 0,
      status: params.preserveCurrentStatus ? ticket.status : 'open',
      currentAgentId: ticket.isGroup
        ? null
        : params.preserveCurrentAgent
          ? ticket.currentAgentId
          : (ticket.currentAgentId ?? actor.id),
      updatedAt: new Date(),
    },
  });

  await app.prisma.ticketEvent.create({
    data: {
      id: randomUUID(),
      ticketId: ticket.id,
      eventType: 'message_out',
      actorUserId: actor.id,
      metadata: {
        messageId: message.id,
        externalMessageId,
        contentType: attachmentInput?.kind ?? 'text',
        attachmentName: attachmentInput?.fileName ?? null,
        internalNote: isInternalNote,
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
    lastMessagePreview: preview,
    unreadCount: 0,
  });

  return { ticket, message, preview };
}
