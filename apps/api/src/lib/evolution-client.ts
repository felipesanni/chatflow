import { randomUUID } from 'node:crypto';

interface SendTextParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  text: string;
  quotedMessageId?: string;
}

export async function sendEvolutionText(params: SendTextParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${cleanUrl}/message/sendText/${params.instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.apiKey,
    },
    body: JSON.stringify({
      number: params.remoteJid,
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
