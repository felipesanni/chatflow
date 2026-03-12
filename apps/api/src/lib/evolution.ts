import { randomUUID } from 'node:crypto';

interface EvolutionMessage {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  pushName?: string;
  message?: Record<string, unknown>;
}

interface ParsedEvolutionContent {
  body: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'other';
}

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

function extractText(message: EvolutionMessage | null): ParsedEvolutionContent {
  const content = message?.message as Record<string, any> | undefined;

  if (!content) {
    return { body: 'Mensagem vazia', contentType: 'other' };
  }

  const inner = content.ephemeralMessage?.message
    || content.viewOnceMessage?.message
    || content.viewOnceMessageV2?.message
    || content.viewOnceMessageV2Extension?.message
    || content.documentWithCaptionMessage?.message
    || content;

  if (inner.conversation) return { body: inner.conversation as string, contentType: 'text' };
  if (inner.extendedTextMessage?.text) return { body: inner.extendedTextMessage.text as string, contentType: 'text' };
  if (inner.imageMessage) return { body: (inner.imageMessage.caption as string) || 'Imagem recebida', contentType: 'image' };
  if (inner.audioMessage) return { body: 'Audio recebido', contentType: 'audio' };
  if (inner.videoMessage) return { body: (inner.videoMessage.caption as string) || 'Video recebido', contentType: 'video' };
  if (inner.documentMessage) return { body: (inner.documentMessage.caption as string) || (inner.documentMessage.fileName as string) || 'Documento recebido', contentType: 'document' };
  if (inner.stickerMessage) return { body: 'Sticker recebido', contentType: 'sticker' };

  return { body: 'Midia recebida', contentType: 'other' };
}

export function parseEvolutionWebhook(payload: Record<string, unknown>) {
  const message = pickMessage(payload);
  const remoteJid = message?.key?.remoteJid ?? null;
  const externalMessageId = message?.key?.id ?? randomUUID();
  const fromMe = message?.key?.fromMe === true;
  const phone = normalizePhone(remoteJid ?? undefined);
  const parsedContent = extractText(message);

  return {
    event: typeof payload.event === 'string' ? payload.event : 'unknown',
    instanceName: typeof payload.instance === 'string' ? payload.instance : null,
    remoteJid,
    externalMessageId,
    fromMe,
    phone,
    pushName: message?.pushName ?? null,
    body: parsedContent.body,
    contentType: parsedContent.contentType,
    rawPayload: payload,
    isGroup: Boolean(remoteJid?.includes('@g.us')),
  };
}
