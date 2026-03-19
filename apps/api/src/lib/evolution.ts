import { randomUUID } from 'node:crypto';

interface EvolutionMessage {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  pushName?: string;
  participant?: string;
  verifiedBizName?: string;
  message?: Record<string, unknown>;
}

interface ParsedEvolutionContent {
  body: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'other';
  attachments: Array<{
    fileName: string | null;
    mimeType: string;
    sizeBytes: number | null;
    storage: 'external';
    storageKey: string;
    publicUrl: string | null;
  }>;
}

const EVENT_ALIASES: Record<string, string> = {
  'messages.upsert': 'MESSAGES_UPSERT',
  'messages.update': 'MESSAGES_UPDATE',
  'qrcode.updated': 'QRCODE_UPDATED',
  'connection.update': 'CONNECTION_UPDATE',
};

function pickMessage(payload: Record<string, unknown>): EvolutionMessage | null {
  const data = payload.data as Record<string, unknown> | EvolutionMessage[] | undefined;

  if (Array.isArray(data)) {
    return (data[0] as EvolutionMessage | undefined) ?? null;
  }

  if (data && typeof data === 'object' && 'messages' in data && Array.isArray((data as { messages?: unknown[] }).messages)) {
    return ((data as { messages?: EvolutionMessage[] }).messages?.[0]) ?? null;
  }

  if (data && typeof data === 'object') {
    return data as EvolutionMessage;
  }

  return null;
}

function normalizePhone(jid: string | undefined) {
  if (!jid) return null;
  return jid.split('@')[0]?.replace(/[^0-9]/g, '') || null;
}

function normalizeMediaUrl(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeMimeType(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function normalizeFileName(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
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

function extractGroupName(payload: Record<string, unknown>, message: EvolutionMessage | null, remoteJid: string | null) {
  if (!remoteJid?.includes('@g.us')) {
    return null;
  }

  const data = pickObject(payload.data);
  const messageContent = pickObject(message?.message);
  const contextInfo = pickObject(messageContent?.messageContextInfo);
  const extendedText = pickObject(messageContent?.extendedTextMessage);
  const extendedContext = pickObject(extendedText?.contextInfo);
  const groupMetadata = pickObject(data?.groupMetadata);
  const groupInfo = pickObject(data?.groupInfo);
  const key = pickObject(message?.key);

  return pickFirstNonEmptyString([
    data?.subject,
    data?.groupSubject,
    data?.groupName,
    groupMetadata?.subject,
    groupMetadata?.name,
    groupInfo?.subject,
    groupInfo?.name,
    messageContent?.groupName,
    messageContent?.groupSubject,
    contextInfo?.groupSubject,
    extendedContext?.groupSubject,
    key?.subject,
    payload.subject,
    payload.groupSubject,
    payload.groupName,
  ]);
}

function normalizeSizeBytes(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildExternalAttachment(params: {
  url: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  fallbackMimeType: string;
  fallbackStorageKey: string;
}) {
  const publicUrl = normalizeMediaUrl(params.url);

  return {
    fileName: normalizeFileName(params.fileName),
    mimeType: normalizeMimeType(params.mimeType, params.fallbackMimeType),
    sizeBytes: normalizeSizeBytes(params.sizeBytes),
    storage: 'external' as const,
    storageKey: publicUrl ?? params.fallbackStorageKey,
    publicUrl,
  };
}

function extractText(message: EvolutionMessage | null): ParsedEvolutionContent {
  const content = message?.message as Record<string, any> | undefined;

  if (!content) {
    return { body: 'Mensagem vazia', contentType: 'other', attachments: [] };
  }

  const inner = content.ephemeralMessage?.message
    || content.viewOnceMessage?.message
    || content.viewOnceMessageV2?.message
    || content.viewOnceMessageV2Extension?.message
    || content.documentWithCaptionMessage?.message
    || content;

  if (inner.conversation) return { body: inner.conversation as string, contentType: 'text', attachments: [] };
  if (inner.extendedTextMessage?.text) return { body: inner.extendedTextMessage.text as string, contentType: 'text', attachments: [] };
  if (inner.imageMessage) {
    return {
      body: (inner.imageMessage.caption as string) || 'Imagem recebida',
      contentType: 'image',
      attachments: [
        buildExternalAttachment({
          url: inner.imageMessage.url ?? inner.imageMessage.directPath,
          fileName: inner.imageMessage.fileName ?? inner.imageMessage.caption,
          mimeType: inner.imageMessage.mimetype,
          sizeBytes: inner.imageMessage.fileLength ?? inner.imageMessage.fileLengthLow,
          fallbackMimeType: 'image/jpeg',
          fallbackStorageKey: `image:${message?.key?.id ?? randomUUID()}`,
        }),
      ],
    };
  }
  if (inner.audioMessage) {
    return {
      body: 'Audio recebido',
      contentType: 'audio',
      attachments: [
        buildExternalAttachment({
          url: inner.audioMessage.url ?? inner.audioMessage.directPath,
          fileName: 'audio.ogg',
          mimeType: inner.audioMessage.mimetype,
          sizeBytes: inner.audioMessage.fileLength ?? inner.audioMessage.fileLengthLow,
          fallbackMimeType: 'audio/ogg',
          fallbackStorageKey: `audio:${message?.key?.id ?? randomUUID()}`,
        }),
      ],
    };
  }
  if (inner.videoMessage) {
    return {
      body: (inner.videoMessage.caption as string) || 'Video recebido',
      contentType: 'video',
      attachments: [
        buildExternalAttachment({
          url: inner.videoMessage.url ?? inner.videoMessage.directPath,
          fileName: inner.videoMessage.fileName ?? inner.videoMessage.caption,
          mimeType: inner.videoMessage.mimetype,
          sizeBytes: inner.videoMessage.fileLength ?? inner.videoMessage.fileLengthLow,
          fallbackMimeType: 'video/mp4',
          fallbackStorageKey: `video:${message?.key?.id ?? randomUUID()}`,
        }),
      ],
    };
  }
  if (inner.documentMessage) {
    return {
      body: (inner.documentMessage.caption as string) || (inner.documentMessage.fileName as string) || 'Documento recebido',
      contentType: 'document',
      attachments: [
        buildExternalAttachment({
          url: inner.documentMessage.url ?? inner.documentMessage.directPath,
          fileName: inner.documentMessage.fileName,
          mimeType: inner.documentMessage.mimetype,
          sizeBytes: inner.documentMessage.fileLength ?? inner.documentMessage.fileLengthLow,
          fallbackMimeType: 'application/octet-stream',
          fallbackStorageKey: `document:${message?.key?.id ?? randomUUID()}`,
        }),
      ],
    };
  }
  if (inner.stickerMessage) return { body: 'Sticker recebido', contentType: 'sticker', attachments: [] };

  return { body: 'Midia recebida', contentType: 'other', attachments: [] };
}

export function normalizeEvolutionEventName(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'UNKNOWN';
  }

  const normalized = value.trim();
  const alias = EVENT_ALIASES[normalized.toLowerCase()];

  if (alias) {
    return alias;
  }

  return normalized.toUpperCase().replace(/[.\s-]+/g, '_');
}

interface ParseEvolutionPayloadOptions {
  event?: string | null;
  instanceName?: string | null;
}

export function parseEvolutionPayload(
  payload: Record<string, unknown>,
  options: ParseEvolutionPayloadOptions = {},
) {
  const message = pickMessage(payload);
  const remoteJid = message?.key?.remoteJid ?? null;
  const externalMessageId = message?.key?.id ?? randomUUID();
  const fromMe = message?.key?.fromMe === true;
  const phone = normalizePhone(remoteJid ?? undefined);
  const parsedContent = extractText(message);
  const payloadInstance = typeof payload.instance === 'string' ? payload.instance : null;
  const groupName = extractGroupName(payload, message, remoteJid);

  return {
    event: normalizeEvolutionEventName(options.event ?? payload.event),
    instanceName: options.instanceName ?? payloadInstance,
    remoteJid,
    externalMessageId,
    fromMe,
    phone,
    pushName: message?.pushName ?? null,
    groupName,
    body: parsedContent.body,
    contentType: parsedContent.contentType,
    attachments: parsedContent.attachments,
    rawPayload: payload,
    isGroup: Boolean(remoteJid?.includes('@g.us')),
  };
}

export function parseEvolutionWebhook(payload: Record<string, unknown>) {
  return parseEvolutionPayload(payload);
}
