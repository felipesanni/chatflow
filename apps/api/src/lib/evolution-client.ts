import { randomUUID } from 'node:crypto';

interface SendTextParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  text: string;
  quotedMessageId?: string;
}

interface ConfigureWebhookParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  webhookUrl: string;
}

function normalizeDestination(remoteJid: string) {
  if (remoteJid.includes('@g.us')) {
    return remoteJid;
  }

  return remoteJid.split('@')[0] ?? remoteJid;
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

export async function configureEvolutionWebhook(params: ConfigureWebhookParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');

  const response = await fetch(`${cleanUrl}/webhook/set/${params.instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.apiKey,
    },
    body: JSON.stringify({
      url: params.webhookUrl,
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'QRCODE_UPDATED', 'CONNECTION_UPDATE'],
      webhook_by_events: false,
      webhook_base64: false,
      webhookByEvents: false,
      webhookBase64: false,
      enabled: true,
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
  };
}
