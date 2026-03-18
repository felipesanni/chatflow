import { randomUUID } from 'node:crypto';

interface SendTextParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  text: string;
  quotedMessageId?: string;
}

interface SendMediaParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  mediaType: 'image' | 'document';
  fileName: string;
  mimeType: string;
  base64: string;
  caption?: string;
  quotedMessageId?: string;
}

interface SendAudioParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  base64: string;
  quotedMessageId?: string;
}

interface ConfigureWebhookParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  webhookUrl: string;
}

interface FetchProfilePictureParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
}

const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'QRCODE_UPDATED', 'CONNECTION_UPDATE'];
const WEBSOCKET_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'QRCODE_UPDATED', 'CONNECTION_UPDATE'];

function normalizeDestination(remoteJid: string) {
  if (remoteJid.includes('@g.us')) {
    return remoteJid;
  }

  return remoteJid.split('@')[0] ?? remoteJid;
}

function pickProfilePictureUrl(payload: any) {
  return payload?.profilePictureUrl
    ?? payload?.pictureUrl
    ?? payload?.url
    ?? payload?.data?.profilePictureUrl
    ?? payload?.data?.pictureUrl
    ?? payload?.data?.url
    ?? null;
}

export async function sendEvolutionText(params: SendTextParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const destination = normalizeDestination(params.remoteJid);

  const response = await fetch(`${cleanUrl}/message/sendText/${params.instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.apiKey,
    },
    body: JSON.stringify({
      number: destination,
      text: params.text,
      delay: 300,
      quoted: params.quotedMessageId ? { key: { id: params.quotedMessageId } } : undefined,
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    messageId: payload?.key?.id ?? payload?.message?.key?.id ?? randomUUID(),
  };
}

export async function sendEvolutionMedia(params: SendMediaParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const destination = normalizeDestination(params.remoteJid);

  const response = await fetch(`${cleanUrl}/message/sendMedia/${params.instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.apiKey,
    },
    body: JSON.stringify({
      number: destination,
      mediatype: params.mediaType,
      fileName: params.fileName,
      caption: params.caption,
      mimetype: params.mimeType,
      media: params.base64,
      delay: 300,
      quoted: params.quotedMessageId ? { key: { id: params.quotedMessageId } } : undefined,
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    messageId: payload?.key?.id ?? payload?.message?.key?.id ?? randomUUID(),
  };
}

export async function sendEvolutionAudio(params: SendAudioParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const destination = normalizeDestination(params.remoteJid);

  const response = await fetch(`${cleanUrl}/message/sendWhatsAppAudio/${params.instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.apiKey,
    },
    body: JSON.stringify({
      number: destination,
      audio: params.base64,
      delay: 300,
      quoted: params.quotedMessageId ? { key: { id: params.quotedMessageId } } : undefined,
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    messageId: payload?.key?.id ?? payload?.message?.key?.id ?? randomUUID(),
  };
}

export async function fetchEvolutionProfilePictureUrl(params: FetchProfilePictureParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${cleanUrl}/chat/fetchProfilePictureUrl/${params.instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.apiKey,
    },
    body: JSON.stringify({
      number: params.remoteJid,
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    profilePictureUrl: pickProfilePictureUrl(payload),
  };
}

export async function configureEvolutionWebhook(params: ConfigureWebhookParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const requestBody = {
    enabled: true,
    url: params.webhookUrl,
    webhookByEvents: false,
    webhookBase64: false,
    events: WEBHOOK_EVENTS,
  };

  async function execute(body: Record<string, unknown>) {
    const response = await fetch(`${cleanUrl}/webhook/set/${params.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.apiKey,
      },
      body: JSON.stringify(body),
    });

    let payload: any = null;
    try {
      const raw = await response.text();
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  }

  const attempts = [
    { body: { webhook: requestBody } },
    { body: requestBody },
  ];

  let lastAttempt = null as Awaited<ReturnType<typeof execute>> | null;

  for (const attempt of attempts) {
    lastAttempt = await execute(attempt.body);

    if (lastAttempt.ok) {
      return lastAttempt;
    }
  }

  return lastAttempt ?? {
    ok: false,
    status: 500,
    payload: null,
  };
}

export async function configureEvolutionWebSocket(params: Omit<ConfigureWebhookParams, 'webhookUrl'>) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const requestBody = {
    enabled: true,
    events: WEBSOCKET_EVENTS,
  };

  async function execute(body: Record<string, unknown>) {
    const response = await fetch(`${cleanUrl}/websocket/set/${params.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.apiKey,
      },
      body: JSON.stringify(body),
    });

    let payload: any = null;
    try {
      const raw = await response.text();
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  }

  const attempts = [
    { body: { websocket: requestBody } },
    { body: { websocket: { enabled: true } } },
    { body: requestBody },
  ];

  let lastAttempt = null as Awaited<ReturnType<typeof execute>> | null;

  for (const attempt of attempts) {
    lastAttempt = await execute(attempt.body);

    if (lastAttempt.ok) {
      return lastAttempt;
    }
  }

  return lastAttempt ?? {
    ok: false,
    status: 500,
    payload: null,
  };
}
