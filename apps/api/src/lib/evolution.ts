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
  update?: {
    message?: Record<string, unknown>;
  };
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

interface ParsedReactionPayload {
  emoji: string;
  targetExternalMessageId: string;
}

interface ParsedDeletionPayload {
  targetExternalMessageId: string;
}

interface ResolvedEvolutionContent {
  content: Record<string, any> | null;
  isEdited: boolean;
  targetKey: Record<string, unknown> | null;
}

const EVENT_ALIASES: Record<string, string> = {
  'messages.upsert': 'MESSAGES_UPSERT',
  'messages.update': 'MESSAGES_UPDATE',
  'messages.edited': 'MESSAGES_EDITED',
  'messages.delete': 'MESSAGES_DELETE',
  'messages.deleted': 'MESSAGES_DELETE',
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

function unwrapMessageContainer(value: unknown): Record<string, any> | null {
  let current = pickObject(value) as Record<string, any> | null;

  while (current) {
    const next = pickObject(
      current.ephemeralMessage?.message
      ?? current.viewOnceMessage?.message
      ?? current.viewOnceMessageV2?.message
      ?? current.viewOnceMessageV2Extension?.message
      ?? current.documentWithCaptionMessage?.message
      ?? current.message,
    ) as Record<string, any> | null;

    if (!next) {
      return current;
    }

    current = next;
  }

  return null;
}

function normalizePhone(jid: string | undefined) {
  if (!jid) return null;

  const [localPart, domain = ''] = jid.split('@');
  const normalizedDomain = domain.toLowerCase();

  if (!localPart || !['s.whatsapp.net', 'c.us'].includes(normalizedDomain)) {
    return null;
  }

  const digits = localPart.replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }

  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  if (digits.startsWith('0')) {
    return null;
  }

  if (/^(\d)\1+$/.test(digits)) {
    return null;
  }

  return digits;
}

function normalizePhoneCandidate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const fromJid = normalizePhone(trimmed);
  if (fromJid) {
    return fromJid;
  }

  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }

  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  if (digits.startsWith('0')) {
    return null;
  }

  if (/^(\d)\1+$/.test(digits)) {
    return null;
  }

  return digits;
}

function pickPhoneCandidate(values: unknown[]) {
  for (const value of values) {
    const normalized = normalizePhoneCandidate(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
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

function collectGroupNameCandidates(value: unknown, remoteJid: string, depth = 0, seen = new WeakSet<object>()): string[] {
  if (depth > 8) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectGroupNameCandidates(item, remoteJid, depth + 1, seen));
  }

  const record = pickObject(value);
  if (!record) {
    return [];
  }

  if (seen.has(record)) {
    return [];
  }

  seen.add(record);

  const maybeGroupId = pickFirstNonEmptyString([
    record.id,
    record.jid,
    record.remoteJid,
    record.groupId,
    record.chatId,
  ]);
  const looksLikeGroupMetadata =
    maybeGroupId === remoteJid
    || record.groupMetadata !== undefined
    || record.groupInfo !== undefined
    || Array.isArray(record.participants)
    || typeof record.descOwner === 'string'
    || typeof record.owner === 'string';

  const localCandidates = looksLikeGroupMetadata
    ? [
        record.subject,
        record.groupSubject,
        record.groupName,
        record.formattedTitle,
        record.title,
        record.notify,
        record.name,
      ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
    : [];

  const nestedCandidates = Object.values(record).flatMap((child) => collectGroupNameCandidates(child, remoteJid, depth + 1, seen));

  return [...localCandidates, ...nestedCandidates];
}

function findEditedProtocolMessage(value: unknown, depth = 0): { editedMessage: Record<string, any>; targetKey: Record<string, unknown> | null } | null {
  if (depth > 8) {
    return null;
  }

  const record = pickObject(value);
  if (!record) {
    return null;
  }

  const protocolMessage = pickObject(record.protocolMessage);
  const editedMessage = unwrapMessageContainer(protocolMessage?.editedMessage);

  if (editedMessage) {
    return {
      editedMessage,
      targetKey: pickObject(protocolMessage?.key),
    };
  }

  const directEditedMessage = unwrapMessageContainer(record.editedMessage);
  if (directEditedMessage) {
    return {
      editedMessage: directEditedMessage,
      targetKey: pickObject(record.key),
    };
  }

  const nestedCandidates = [
    record.message,
    record.ephemeralMessage,
    record.viewOnceMessage,
    record.viewOnceMessageV2,
    record.viewOnceMessageV2Extension,
    record.documentWithCaptionMessage,
  ];

  for (const child of nestedCandidates) {
    const nested = findEditedProtocolMessage(child, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function looksLikeMessageKey(value: unknown) {
  const record = pickObject(value);
  if (!record) {
    return false;
  }

  return (
    typeof record.id === 'string'
    || typeof record.remoteJid === 'string'
    || typeof record.participant === 'string'
    || typeof record.fromMe === 'boolean'
  );
}

function buildSyntheticMessageKey(value: unknown) {
  const record = pickObject(value);
  if (!record) {
    return null;
  }

  const id = pickFirstNonEmptyString([
    record.stanzaId,
    record.messageId,
    record.originalMessageId,
    record.targetMessageId,
  ]);
  const remoteJid = pickFirstNonEmptyString([
    record.remoteJid,
    record.chatId,
    record.jid,
    record.conversation,
  ]);
  const participant = pickFirstNonEmptyString([
    record.participant,
    record.senderJid,
    record.author,
  ]);
  const fromMe = typeof record.fromMe === 'boolean' ? record.fromMe : undefined;

  if (!id) {
    return null;
  }

  return {
    id,
    ...(remoteJid ? { remoteJid } : {}),
    ...(participant ? { participant } : {}),
    ...(typeof fromMe === 'boolean' ? { fromMe } : {}),
  } as Record<string, unknown>;
}

function findMessageKeyCandidate(value: unknown, depth = 0, seen = new WeakSet<object>()): Record<string, unknown> | null {
  if (depth > 8) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findMessageKeyCandidate(item, depth + 1, seen);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  const record = pickObject(value);
  if (!record) {
    return null;
  }

  if (seen.has(record)) {
    return null;
  }

  seen.add(record);

  const prioritizedCandidates = [
    record.key,
    record.messageKey,
    record.contextInfo,
    record.messageContextInfo,
    pickObject(record.message)?.key,
    pickObject(record.update)?.key,
    pickObject(record.protocolMessage)?.key,
    pickObject(record.reactionMessage)?.key,
    pickObject(record.editedMessage)?.key,
    pickObject(record.extendedTextMessage)?.contextInfo,
    pickObject(record.imageMessage)?.contextInfo,
    pickObject(record.videoMessage)?.contextInfo,
    pickObject(record.documentMessage)?.contextInfo,
    record.originalMessageKey,
    record.originalKey,
    record.targetKey,
    record.messages,
    record.keys,
    record.data,
  ];

  for (const candidate of prioritizedCandidates) {
    const nested = findMessageKeyCandidate(candidate, depth + 1, seen);
    if (nested) {
      return nested;
    }
  }

  for (const candidate of Object.values(record)) {
    const nested = findMessageKeyCandidate(candidate, depth + 1, seen);
    if (nested) {
      return nested;
    }
  }

  const syntheticKey = buildSyntheticMessageKey(record);
  if (syntheticKey) {
    return syntheticKey;
  }

  if (looksLikeMessageKey(record)) {
    return record;
  }

  return null;
}

function resolveMessageContent(message: EvolutionMessage | null, payload?: Record<string, unknown>): ResolvedEvolutionContent {
  const directContentCandidates = [
    pickObject(message?.message),
    pickObject(message?.update?.message),
  ].filter((candidate): candidate is Record<string, unknown> => Boolean(candidate));

  const editCandidates = [
    ...directContentCandidates,
    pickObject(payload?.data),
    pickObject(payload),
  ].filter((candidate): candidate is Record<string, unknown> => Boolean(candidate));

  for (const content of editCandidates) {
    const editedProtocolMessage = findEditedProtocolMessage(content);

    if (editedProtocolMessage) {
      return {
        content: editedProtocolMessage.editedMessage,
        isEdited: true,
        targetKey: editedProtocolMessage.targetKey,
      };
    }
  }

  for (const content of directContentCandidates) {
    const unwrapped = unwrapMessageContainer(content);
    if (unwrapped) {
      return {
        content: unwrapped,
        isEdited: false,
        targetKey: null,
      };
    }
  }

  return {
    content: null,
    isEdited: false,
    targetKey: null,
  };
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
  const recursiveCandidates = collectGroupNameCandidates(payload, remoteJid);

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
    ...recursiveCandidates,
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

function extractReactionPayload(message: EvolutionMessage | null, content: Record<string, any> | null): ParsedReactionPayload | null {
  const reactionMessage = pickObject(content?.reactionMessage);

  if (!reactionMessage) {
    return null;
  }

  const targetKey = pickObject(reactionMessage.key);
  const targetExternalMessageId = typeof targetKey?.id === 'string' ? targetKey.id.trim() : '';
  const emoji = typeof reactionMessage.text === 'string' ? reactionMessage.text.trim() : '';

  if (!targetExternalMessageId || !emoji) {
    return null;
  }

  return {
    emoji,
    targetExternalMessageId,
  };
}

function extractDeletionPayload(
  payload: Record<string, unknown>,
  message: EvolutionMessage | null,
  content: Record<string, any> | null,
  normalizedEvent: string,
): ParsedDeletionPayload | null {
  const protocolDeletion = findDeletedProtocolMessage(
    pickObject(message?.message)
    ?? pickObject(message?.update?.message)
    ?? content
    ?? pickObject(payload.data),
  );

  if (protocolDeletion) {
    return protocolDeletion;
  }

  if (normalizedEvent !== 'MESSAGES_DELETE') {
    return null;
  }

  const candidateKey = findMessageKeyCandidate([
    message?.update,
    message,
    payload.data,
    payload,
  ]);
  const targetExternalMessageId = typeof candidateKey?.id === 'string' ? candidateKey.id.trim() : '';

  if (!targetExternalMessageId) {
    return null;
  }

  return {
    targetExternalMessageId,
  };
}

function findDeletedProtocolMessage(value: unknown, depth = 0): ParsedDeletionPayload | null {
  if (depth > 8) {
    return null;
  }

  const record = pickObject(value);
  if (!record) {
    return null;
  }

  const protocolMessage = pickObject(record.protocolMessage);
  const targetKey = pickObject(protocolMessage?.key);
  const protocolType = protocolMessage?.type;

  if (
    typeof targetKey?.id === 'string'
    && targetKey.id.trim().length > 0
    && (protocolType === 0 || protocolType === 'REVOKE' || protocolType === 'revoke')
  ) {
    return {
      targetExternalMessageId: targetKey.id.trim(),
    };
  }

  const nestedCandidates = [
    record.message,
    record.editedMessage,
    record.ephemeralMessage,
    record.viewOnceMessage,
    record.viewOnceMessageV2,
    record.viewOnceMessageV2Extension,
    record.documentWithCaptionMessage,
  ];

  for (const child of nestedCandidates) {
    const nested = findDeletedProtocolMessage(child, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractText(message: EvolutionMessage | null, content: Record<string, any> | null): ParsedEvolutionContent {
  if (!content) {
    return { body: 'Mensagem vazia', contentType: 'other', attachments: [] };
  }
  const inner = content;

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
  if (inner.stickerMessage) {
    return {
      body: 'Sticker recebido',
      contentType: 'sticker',
      attachments: [
        buildExternalAttachment({
          url: inner.stickerMessage.url ?? inner.stickerMessage.directPath,
          fileName: 'sticker.webp',
          mimeType: inner.stickerMessage.mimetype,
          sizeBytes: inner.stickerMessage.fileLength ?? inner.stickerMessage.fileLengthLow,
          fallbackMimeType: 'image/webp',
          fallbackStorageKey: `sticker:${message?.key?.id ?? randomUUID()}`,
        }),
      ],
    };
  }

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
  const normalizedEvent = normalizeEvolutionEventName(options.event ?? payload.event);
  const resolvedContent = resolveMessageContent(message, payload);
  const hasDirectUpdateMessage = Boolean(
    pickObject(message?.update?.message)
    ?? pickObject(pickObject(payload.data)?.update)?.message
    ?? pickObject(payload.data),
  );
  const effectiveKey =
    resolvedContent.targetKey
    ?? findMessageKeyCandidate([
      message?.update,
      pickObject(payload.data)?.key,
      pickObject(payload.data)?.messageKey,
      pickObject(payload.data)?.messages,
      pickObject(payload.data)?.keys,
      payload.data,
    ])
    ?? pickObject(message?.key);
  const remoteJid = typeof effectiveKey?.remoteJid === 'string'
    ? effectiveKey.remoteJid
    : message?.key?.remoteJid ?? null;
  const externalMessageId = typeof effectiveKey?.id === 'string'
    ? effectiveKey.id
    : message?.key?.id ?? randomUUID();
  const fromMe = typeof effectiveKey?.fromMe === 'boolean'
    ? effectiveKey.fromMe
    : message?.key?.fromMe === true;
  const data = pickObject(payload.data);
  const messageKey = pickObject(message?.key);
  const phone = pickPhoneCandidate([
    remoteJid,
    effectiveKey?.participant,
    message?.participant,
    messageKey?.participant,
    data?.participant,
    data?.sender,
    data?.senderJid,
    data?.senderLid,
    data?.phone,
    data?.number,
    data?.contact,
    pickObject(data?.key)?.participant,
    pickObject(data?.key)?.remoteJid,
    pickObject(data?.sender)?.id,
    pickObject(data?.sender)?.jid,
    pickObject(data?.sender)?.phone,
  ]);
  const parsedContent = extractText(message, resolvedContent.content);
  const reaction = extractReactionPayload(message, resolvedContent.content);
  const deletion = extractDeletionPayload(payload, message, resolvedContent.content, normalizedEvent);
  const payloadInstance = typeof payload.instance === 'string' ? payload.instance : null;
  const groupName = extractGroupName(payload, message, remoteJid);
  const isEdited =
    resolvedContent.isEdited
    || normalizedEvent === 'MESSAGES_EDITED'
    || (normalizedEvent === 'MESSAGES_UPDATE' && hasDirectUpdateMessage);

  return {
    event: normalizedEvent,
    instanceName: options.instanceName ?? payloadInstance,
    remoteJid,
    externalMessageId,
    fromMe,
    phone,
    pushName: message?.pushName ?? null,
    verifiedBizName: message?.verifiedBizName ?? null,
    groupName,
    body: parsedContent.body,
    contentType: parsedContent.contentType,
    attachments: parsedContent.attachments,
    reaction,
    deletion,
    rawPayload: payload,
    isGroup: Boolean(remoteJid?.includes('@g.us')),
    isEdited,
    editedAt: isEdited ? new Date() : null,
  };
}

export function parseEvolutionWebhook(payload: Record<string, unknown>) {
  return parseEvolutionPayload(payload);
}
