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

function extractText(message: EvolutionMessage | null) {
  const content = message?.message as Record<string, any> | undefined;

  if (!content) {
    return 'Mensagem vazia';
  }

  const inner = content.ephemeralMessage?.message
    || content.viewOnceMessage?.message
    || content.viewOnceMessageV2?.message
    || content.viewOnceMessageV2Extension?.message
    || content.documentWithCaptionMessage?.message
    || content;

  if (inner.conversation) return { body: inner.conversation as string, contentType: 'text' as const };
  if (inner.extendedTextMessage?.text) return { body: inner.extendedTextMessage.text as string, contentType: 'text' as const };
  if (inner.imageMessage) return { body: (inner.imageMessage.caption as string) || 'Imagem recebida', contentType: 'image' as const };
  if (inner.audioMessage) return { body: 'Audio recebido', contentType: 'audio' as const };
  if (inner.videoMessage) return { body: (inner.videoMessage.caption as string) || 'Video recebido', contentType: 'video' as const };
  if (inner.documentMessage) return { body: (inner.documentMessage.caption as string) || (inner.documentMessage.fileName as string) || 'Documento recebido', contentType: 'document' as const };
  if (inner.stickerMessage) return { body: 'Sticker recebido', contentType: 'sticker' as const };

  return { body: 'Midia recebida', contentType: 'other' as const };
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
    ...parsedContent,
    rawPayload: payload,
    isGroup: Boolean(remoteJid?.includes('@g.us')),
  };
}
