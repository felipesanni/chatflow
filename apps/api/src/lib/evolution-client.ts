import { randomUUID } from 'node:crypto';

interface SendTextParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  text: string;
  quotedMessageId?: string;
}

interface UpdateTextParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  externalMessageId: string;
  text: string;
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

interface SendReactionParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  externalMessageId: string;
  emoji: string;
  fromMe?: boolean;
}

interface DeleteMessageParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  externalMessageId: string;
  fromMe?: boolean;
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

interface FetchGroupNameParams {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
}

const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_EDITED', 'MESSAGES_DELETE', 'QRCODE_UPDATED', 'CONNECTION_UPDATE'];
const WEBSOCKET_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_EDITED', 'MESSAGES_DELETE', 'QRCODE_UPDATED', 'CONNECTION_UPDATE'];
const LEGACY_WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'QRCODE_UPDATED', 'CONNECTION_UPDATE'];
const LEGACY_WEBSOCKET_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'QRCODE_UPDATED', 'CONNECTION_UPDATE'];

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

function pickGroupName(payload: any) {
  const candidates = [
    payload?.subject,
    payload?.name,
    payload?.groupName,
    payload?.groupSubject,
    payload?.title,
    payload?.data?.subject,
    payload?.data?.name,
    payload?.data?.groupName,
    payload?.data?.groupSubject,
    payload?.data?.title,
    payload?.groupMetadata?.subject,
    payload?.groupMetadata?.name,
    payload?.groupInfo?.subject,
    payload?.groupInfo?.name,
    payload?.data?.groupMetadata?.subject,
    payload?.data?.groupMetadata?.name,
    payload?.data?.groupInfo?.subject,
    payload?.data?.groupInfo?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
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

export async function sendEvolutionUpdateMessage(params: UpdateTextParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const destination = normalizeDestination(params.remoteJid);

  async function execute(path: string, method: 'PUT' | 'POST', body: Record<string, unknown>) {
    const response = await fetch(`${cleanUrl}${path}/${params.instanceName}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: params.apiKey,
      },
      body: JSON.stringify(body),
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
      messageId: params.externalMessageId,
    };
  }

  const attempts = [
    {
      number: destination,
      key: {
        id: params.externalMessageId,
        remoteJid: params.remoteJid,
        fromMe: true,
      },
      text: params.text,
    },
    {
      number: destination,
      key: {
        id: params.externalMessageId,
        remoteJid: params.remoteJid,
        fromMe: true,
      },
      message: {
        conversation: params.text,
      },
    },
    {
      number: destination,
      message: {
        key: {
          id: params.externalMessageId,
          remoteJid: params.remoteJid,
          fromMe: true,
        },
        conversation: params.text,
      },
    },
    {
      number: destination,
      key: {
        id: params.externalMessageId,
      },
      text: params.text,
    },
    {
      number: destination,
      messageId: params.externalMessageId,
      text: params.text,
    },
    {
      number: destination,
      id: params.externalMessageId,
      text: params.text,
    },
  ];
  const endpoints = [
    { path: '/chat/updateMessage', method: 'PUT' as const },
    { path: '/chat/updateMessage', method: 'POST' as const },
    { path: '/message/updateMessage', method: 'PUT' as const },
    { path: '/message/updateMessage', method: 'POST' as const },
  ];

  let lastAttempt = null as Awaited<ReturnType<typeof execute>> | null;

  for (const endpoint of endpoints) {
    for (const attempt of attempts) {
      lastAttempt = await execute(endpoint.path, endpoint.method, attempt);
      if (lastAttempt.ok) {
        return lastAttempt;
      }
    }
  }

  return lastAttempt ?? {
    ok: false,
    status: 500,
    payload: null,
    messageId: params.externalMessageId,
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

export async function sendEvolutionReaction(params: SendReactionParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const destination = normalizeDestination(params.remoteJid);
  const targetFromMe = params.fromMe === true;

  async function execute(body: Record<string, unknown>) {
    const response = await fetch(`${cleanUrl}/message/sendReaction/${params.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.apiKey,
      },
      body: JSON.stringify(body),
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

  const attempts = [
    {
      number: destination,
      reactionMessage: {
        key: {
          id: params.externalMessageId,
          remoteJid: params.remoteJid,
          fromMe: targetFromMe,
        },
        text: params.emoji,
      },
    },
    {
      number: destination,
      reaction: {
        key: {
          id: params.externalMessageId,
          remoteJid: params.remoteJid,
          fromMe: targetFromMe,
        },
        text: params.emoji,
      },
    },
    {
      number: destination,
      key: {
        id: params.externalMessageId,
        remoteJid: params.remoteJid,
        fromMe: targetFromMe,
      },
      reaction: params.emoji,
    },
    {
      number: destination,
      messageId: params.externalMessageId,
      reaction: params.emoji,
    },
    {
      number: destination,
      message: {
        key: {
          id: params.externalMessageId,
          remoteJid: params.remoteJid,
          fromMe: targetFromMe,
        },
      },
      reaction: params.emoji,
    },
  ];

  let lastAttempt = null as Awaited<ReturnType<typeof execute>> | null;

  for (const attempt of attempts) {
    lastAttempt = await execute(attempt);
    if (lastAttempt.ok) {
      return lastAttempt;
    }
  }

  return lastAttempt ?? {
    ok: false,
    status: 500,
    payload: null,
    messageId: randomUUID(),
  };
}

export async function sendEvolutionDeleteMessage(params: DeleteMessageParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const destination = normalizeDestination(params.remoteJid);
  const targetFromMe = params.fromMe ?? true;

  async function execute(path: string, method: 'DELETE' | 'POST', body: Record<string, unknown>) {
    const response = await fetch(`${cleanUrl}${path}/${params.instanceName}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: params.apiKey,
      },
      body: JSON.stringify(body),
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
      messageId: params.externalMessageId,
    };
  }

  const attempts = [
    {
      number: destination,
      remoteJid: params.remoteJid,
      fromMe: targetFromMe,
      deleteForEveryone: true,
      key: {
        id: params.externalMessageId,
        remoteJid: params.remoteJid,
        fromMe: targetFromMe,
      },
    },
    {
      number: destination,
      remoteJid: params.remoteJid,
      fromMe: targetFromMe,
      deleteForEveryone: true,
      message: {
        key: {
          id: params.externalMessageId,
          remoteJid: params.remoteJid,
          fromMe: targetFromMe,
        },
      },
    },
    {
      number: destination,
      id: params.externalMessageId,
      remoteJid: params.remoteJid,
      fromMe: targetFromMe,
      deleteForEveryone: true,
    },
    {
      number: destination,
      messageId: params.externalMessageId,
      remoteJid: params.remoteJid,
      fromMe: targetFromMe,
      deleteForEveryone: true,
    },
    {
      number: destination,
      key: {
        id: params.externalMessageId,
      },
      remoteJid: params.remoteJid,
      fromMe: targetFromMe,
      deleteForEveryone: true,
    },
    {
      number: params.remoteJid,
      remoteJid: params.remoteJid,
      fromMe: targetFromMe,
      deleteForEveryone: true,
      key: {
        id: params.externalMessageId,
        remoteJid: params.remoteJid,
        fromMe: targetFromMe,
      },
    },
    {
      chatId: params.remoteJid,
      id: params.externalMessageId,
      fromMe: targetFromMe,
      deleteForEveryone: true,
    },
    {
      jid: params.remoteJid,
      messageId: params.externalMessageId,
      fromMe: targetFromMe,
      deleteForEveryone: true,
    },
    {
      message: {
        id: params.externalMessageId,
        key: {
          id: params.externalMessageId,
          remoteJid: params.remoteJid,
          fromMe: targetFromMe,
        },
      },
      remoteJid: params.remoteJid,
      number: destination,
      fromMe: targetFromMe,
      deleteForEveryone: true,
    },
  ];
  const endpoints = [
    { path: '/chat/deleteMessageForEveryone', method: 'POST' as const },
    { path: '/chat/deleteMessageForEveryone', method: 'DELETE' as const },
    { path: '/message/deleteMessage', method: 'DELETE' as const },
    { path: '/message/deleteMessage', method: 'POST' as const },
    { path: '/chat/deleteMessage', method: 'DELETE' as const },
    { path: '/chat/deleteMessage', method: 'POST' as const },
  ];

  let lastAttempt = null as Awaited<ReturnType<typeof execute>> | null;

  for (const endpoint of endpoints) {
    for (const attempt of attempts) {
      lastAttempt = await execute(endpoint.path, endpoint.method, attempt);
      if (lastAttempt.ok) {
        return lastAttempt;
      }
    }
  }

  return lastAttempt ?? {
    ok: false,
    status: 500,
    payload: null,
    messageId: params.externalMessageId,
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

export async function fetchEvolutionGroupName(params: FetchGroupNameParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');

  async function execute(path: string, body: Record<string, unknown>) {
    const response = await fetch(`${cleanUrl}${path}/${params.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.apiKey,
      },
      body: JSON.stringify(body),
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
      groupName: pickGroupName(payload),
    };
  }

  const attempts = [
    {
      path: '/group/findGroupInfos',
      body: {
        groupJid: params.remoteJid,
      },
    },
    {
      path: '/group/findGroupInfos',
      body: {
        groupJid: [params.remoteJid],
      },
    },
    {
      path: '/group/fetchAllGroups',
      body: {
        getParticipants: false,
      },
    },
    {
      path: '/chat/findMessages',
      body: {
        where: {
          key: {
            remoteJid: params.remoteJid,
          },
        },
      },
    },
  ];

  let lastAttempt = null as Awaited<ReturnType<typeof execute>> | null;

  for (const attempt of attempts) {
    lastAttempt = await execute(attempt.path, attempt.body);

    if (lastAttempt.ok && lastAttempt.groupName) {
      return lastAttempt;
    }
  }

  return lastAttempt ?? {
    ok: false,
    status: 500,
    payload: null,
    groupName: null,
  };
}

export async function configureEvolutionWebhook(params: ConfigureWebhookParams) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');

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

  const attempts = [WEBHOOK_EVENTS, LEGACY_WEBHOOK_EVENTS].flatMap((events) => {
    const requestBody = {
      enabled: true,
      url: params.webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events,
    };

    return [
      { body: { webhook: requestBody } },
      { body: requestBody },
    ];
  });

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

  const attempts = [WEBSOCKET_EVENTS, LEGACY_WEBSOCKET_EVENTS].flatMap((events) => {
    const requestBody = {
      enabled: true,
      events,
    };

    return [
      { body: { websocket: requestBody } },
      { body: { websocket: { enabled: true } } },
      { body: requestBody },
    ];
  });

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
