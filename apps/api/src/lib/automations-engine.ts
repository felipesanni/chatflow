import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { loadEnv } from '../config/env.js';
import { deliverOutboundMessage } from './outbound-messages.js';
import { decryptSecret } from './secrets.js';

type AutomationCondition = {
  field: string;
  operator: string;
  value?: unknown;
  valueLabel?: string;
};

type AutomationAction = {
  type: string;
  config?: Record<string, unknown>;
  summary?: string;
};

type ScheduleConfig = {
  time?: string;
  daysOfWeek?: number[];
};

const env = loadEnv();

type AutomationWithRuntime = {
  id: string;
  name: string;
  triggerType: 'message_received' | 'ticket_created' | 'ticket_inactive' | 'scheduled_time';
  status: 'draft' | 'active' | 'inactive';
  queueId: string | null;
  whatsappInstanceId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  conditions: Prisma.JsonValue;
  actions: Prisma.JsonValue;
  scheduleConfig: Prisma.JsonValue | null;
};

type AutomationTicketContext = {
  id: string;
  status: string;
  currentAgentId: string | null;
  currentAgentName?: string | null;
  currentQueueId: string | null;
  currentQueueName?: string | null;
  whatsappInstanceId: string;
  whatsappInstanceName?: string | null;
  lastMessageAt: Date;
  latestMessageDirection?: string | null;
  latestMessageCreatedAt?: Date | null;
  latestMessageSenderAgentId?: string | null;
  createdAt: Date;
  customerNameSnapshot: string;
  externalChatId: string;
  externalContactId: string | null;
  isGroup: boolean;
};

type AutomationMessageAttachmentContext = {
  id: string;
  fileName: string | null;
  mimeType: string;
  sizeBytes: number | null;
  contentUrl: string;
  publicUrl: string | null;
  dataUrl: string | null;
  base64: string | null;
  encoding: 'base64' | null;
};

type AutomationMessageContext = {
  id: string;
  direction: string;
  contentType?: string | null;
  body: string | null;
  senderName?: string | null;
  externalMessageId?: string | null;
  createdAt: Date;
  attachments?: AutomationMessageAttachmentContext[];
};

type TriggerExecutionContext = {
  triggerType: 'message_received' | 'ticket_created' | 'ticket_inactive' | 'scheduled_time';
  ticket: AutomationTicketContext;
  message?: AutomationMessageContext | null;
  now?: Date;
};

const AUTOMATION_TIME_ZONE = 'America/Sao_Paulo';
const AUTOMATION_TICK_INTERVAL_MS = 60_000;
const automationDedupe = new Map<string, number>();

function parseDataUrl(input: string) {
  const match = input.match(/^data:([^,]+),(.+)$/);

  if (!match) {
    return null;
  }

  const metadata = match[1] ?? '';
  if (!metadata.includes(';base64')) {
    return null;
  }

  return {
    mimeType: metadata.split(';')[0] ?? 'application/octet-stream',
    base64: match[2] ?? '',
  };
}

function resolveExternalAttachmentUrl(baseUrl: string, candidate: string | null) {
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('data:')) {
    return candidate;
  }

  if (/^(image|audio|video|document):/i.test(candidate)) {
    return null;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    return new URL(candidate.replace(/^\.\//, ''), `${baseUrl.replace(/\/$/, '')}/`).toString();
  }
}

function pickMediaMimeType(payload: any, fallback: string) {
  return payload?.mimetype
    ?? payload?.mimeType
    ?? payload?.data?.mimetype
    ?? payload?.data?.mimeType
    ?? payload?.message?.mimetype
    ?? payload?.message?.mimeType
    ?? fallback;
}

function pickMediaBase64(payload: any) {
  return payload?.base64
    ?? payload?.data?.base64
    ?? payload?.message?.base64
    ?? payload?.data?.message?.base64
    ?? payload?.dataUrl
    ?? payload?.data?.dataUrl
    ?? payload?.message?.dataUrl
    ?? payload?.data?.message?.dataUrl
    ?? null;
}

function normalizeMimeFamily(value: string | null | undefined) {
  return (value ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
}

function canTrustDirectMediaResponse(expectedMimeType: string, responseContentType: string | null) {
  const expected = normalizeMimeFamily(expectedMimeType);
  const received = normalizeMimeFamily(responseContentType);

  if (!received) {
    return true;
  }

  if (received === 'application/octet-stream') {
    return true;
  }

  if (received.includes('json') || received.startsWith('text/')) {
    return false;
  }

  if (expected.startsWith('image/')) {
    return received.startsWith('image/');
  }

  if (expected.startsWith('audio/')) {
    return received.startsWith('audio/');
  }

  if (expected.startsWith('video/')) {
    return received.startsWith('video/');
  }

  if (expected === 'application/pdf') {
    return received === 'application/pdf';
  }

  if (expected.startsWith('application/')) {
    return received === expected;
  }

  return true;
}

function looksLikeHtmlDocument(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('<!doctype html')
    || normalized.startsWith('<html')
    || normalized.includes('<body')
    || normalized.includes('<head');
}

function looksLikeBase64Payload(value: string) {
  const normalized = value.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');

  if (normalized.length < 16 || normalized.length % 4 !== 0) {
    return false;
  }

  return /^[a-z0-9+/=]+$/i.test(normalized);
}

async function parseMediaResponseAsDataUrl(response: Response, fallbackMimeType: string) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const base64 = pickMediaBase64(payload);
    if (typeof base64 !== 'string' || base64.trim().length === 0) {
      return null;
    }

    if (base64.startsWith('data:')) {
      return base64;
    }

    const mimeType = pickMediaMimeType(payload, fallbackMimeType || 'application/octet-stream');
    return `data:${mimeType};base64,${base64}`;
  }

  if (contentType.startsWith('text/')) {
    const rawText = (await response.text()).trim();
    if (!rawText) {
      return null;
    }

    if (rawText.startsWith('data:')) {
      return rawText;
    }

    if (looksLikeHtmlDocument(rawText)) {
      return null;
    }

    const normalizedText = rawText.replace(/^["']|["']$/g, '');
    if (!looksLikeBase64Payload(normalizedText)) {
      return null;
    }

    return `data:${fallbackMimeType || 'application/octet-stream'};base64,${normalizedText}`;
  }

  return null;
}

async function fetchEvolutionAttachmentDataUrl(params: {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  remoteJid: string;
  externalMessageId: string;
  mimeType: string;
  fromMe: boolean;
}) {
  const cleanUrl = params.baseUrl.replace(/\/$/, '');
  const endpoints = [
    '/chat/getBase64FromMediaMessage',
    '/message/getBase64FromMediaMessage',
    '/chat/downloadMedia',
    '/message/downloadMedia',
  ];
  const bodies = [
    {
      key: {
        id: params.externalMessageId,
        remoteJid: params.remoteJid,
        fromMe: params.fromMe,
      },
    },
    {
      message: {
        key: {
          id: params.externalMessageId,
          remoteJid: params.remoteJid,
          fromMe: params.fromMe,
        },
      },
    },
    {
      messageId: params.externalMessageId,
      remoteJid: params.remoteJid,
      fromMe: params.fromMe,
    },
  ];

  for (const endpoint of endpoints) {
    for (const body of bodies) {
      try {
        const response = await fetch(`${cleanUrl}${endpoint}/${params.instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: params.apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          continue;
        }

        const parsed = await parseMediaResponseAsDataUrl(response, params.mimeType);
        if (parsed) {
          return parsed;
        }

        const responseContentType = response.headers.get('content-type');
        if (!canTrustDirectMediaResponse(params.mimeType, responseContentType)) {
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer.byteLength) {
          continue;
        }

        const contentType = responseContentType ?? params.mimeType ?? 'application/octet-stream';
        return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
      } catch {
        continue;
      }
    }
  }

  return null;
}

async function resolveAutomationAttachmentDataUrl(params: {
  ticket: {
    externalChatId: string;
    whatsappInstance: {
      baseUrl: string;
      apiKeyEncrypted: string;
      evolutionInstanceName: string;
    };
  };
  message: {
    externalMessageId: string | null;
    direction: string;
  };
  attachment: {
    publicUrl: string | null;
    mimeType: string;
  };
}) {
  const source = params.attachment.publicUrl;
  if (source?.startsWith('data:')) {
    return source;
  }

  const decryptedApiKey = decryptSecret(params.ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);
  let fallbackDataUrl: string | null = null;

  if (params.message.externalMessageId && params.ticket.externalChatId) {
    fallbackDataUrl = await fetchEvolutionAttachmentDataUrl({
      baseUrl: params.ticket.whatsappInstance.baseUrl,
      apiKey: decryptedApiKey,
      instanceName: params.ticket.whatsappInstance.evolutionInstanceName,
      remoteJid: params.ticket.externalChatId,
      externalMessageId: params.message.externalMessageId,
      mimeType: params.attachment.mimeType,
      fromMe: params.message.direction === 'outbound',
    });
  }

  if (fallbackDataUrl) {
    return fallbackDataUrl;
  }

  const targetUrl = resolveExternalAttachmentUrl(params.ticket.whatsappInstance.baseUrl, source ?? null);
  if (!targetUrl) {
    return null;
  }

  let mediaResponse: Response | null = null;

  try {
    mediaResponse = await fetch(targetUrl, {
      headers: {
        apikey: decryptedApiKey,
      },
    });
  } catch {
    mediaResponse = null;
  }

  if (!mediaResponse?.ok) {
    return null;
  }

  const dataUrlFromDirectResponse = await parseMediaResponseAsDataUrl(mediaResponse.clone(), params.attachment.mimeType);
  if (dataUrlFromDirectResponse) {
    return dataUrlFromDirectResponse;
  }

  const responseContentType = mediaResponse.headers.get('content-type');
  if (!canTrustDirectMediaResponse(params.attachment.mimeType, responseContentType)) {
    return null;
  }

  const arrayBuffer = await mediaResponse.arrayBuffer();
  if (!arrayBuffer.byteLength) {
    return null;
  }

  const contentType = responseContentType ?? params.attachment.mimeType ?? 'application/octet-stream';
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
}

function cleanupAutomationDedupe(now = Date.now()) {
  for (const [key, expiresAt] of automationDedupe.entries()) {
    if (expiresAt <= now) {
      automationDedupe.delete(key);
    }
  }
}

function registerAutomationDedupe(key: string, ttlMs: number) {
  const now = Date.now();
  cleanupAutomationDedupe(now);

  const existing = automationDedupe.get(key);
  if (existing && existing > now) {
    return false;
  }

  automationDedupe.set(key, now + ttlMs);
  return true;
}

function asConditions(value: Prisma.JsonValue): AutomationCondition[] {
  return Array.isArray(value) ? value as AutomationCondition[] : [];
}

function getTicketResponsePendingFrom(conditions: AutomationCondition[], actions: AutomationAction[] = []) {
  const condition = conditions.find((item) => item.field === 'ticket.responsePendingFrom');
  if (condition) {
    return condition.value === 'agent' ? 'agent' : 'customer';
  }

  const primaryAction = actions[0];
  return primaryAction?.type === 'nudge_ticket' ? 'agent' : 'customer';
}

function getTicketInactivityMinutes(conditions: AutomationCondition[]) {
  const condition = conditions.find((item) => item.field === 'ticket.inactivityMinutes');
  const expectedMinutes = Number(condition?.value);
  return Number.isFinite(expectedMinutes) && expectedMinutes > 0 ? expectedMinutes : null;
}

function formatConditionFailure(
  condition: AutomationCondition,
  context: TriggerExecutionContext,
  conditions: AutomationCondition[] = [],
  actions: AutomationAction[] = [],
) {
  if (condition.field === 'message.keyword') {
    const keyword = typeof condition.value === 'string' ? condition.value.trim() : '';
    return keyword
      ? `Mensagem não contém a palavra-chave "${keyword}".`
      : 'Palavra-chave da condição não foi informada.';
  }

  if (condition.field === 'ticket.assignment') {
    if (condition.value === 'assigned') {
      return 'Ticket está sem agente responsável.';
    }

    if (condition.value === 'unassigned') {
      return 'Ticket já possui agente responsável.';
    }

    return 'Escopo de atribuição do ticket não foi atendido.';
  }

  if (condition.field === 'ticket.responsePendingFrom') {
    const expected = getTicketResponsePendingFrom([condition], actions);
    if (expected === 'agent') {
      if (!context.ticket.currentAgentId) {
        return 'Ticket está sem agente responsável para cobrar resposta.';
      }

      if (context.ticket.latestMessageDirection !== 'inbound') {
        return 'Última mensagem não foi do cliente; não há resposta pendente do agente.';
      }

      return 'Condição de resposta pendente do agente não foi atendida.';
    }

    if (context.ticket.latestMessageDirection !== 'outbound') {
      return 'Última mensagem não foi do agente; não há resposta pendente do cliente.';
    }

    return 'Condição de resposta pendente do cliente não foi atendida.';
  }

  if (condition.field === 'ticket.inactivityMinutes') {
    const expectedMinutes = Number(condition.value);
    const expectedPendingFrom = getTicketResponsePendingFrom(conditions, actions);

    if (!Number.isFinite(expectedMinutes) || expectedMinutes <= 0) {
      return 'Tempo de inatividade configurado é inválido.';
    }

    if (!context.ticket.latestMessageCreatedAt) {
      return 'Ticket ainda não possui mensagem válida para iniciar a contagem.';
    }

    if (expectedPendingFrom === 'agent') {
      if (!context.ticket.currentAgentId) {
        return 'Ticket está sem agente responsável para medir resposta pendente.';
      }

      if (context.ticket.latestMessageDirection !== 'inbound') {
        return 'Última mensagem não foi do cliente; a contagem para resposta do agente não começou.';
      }
    } else if (context.ticket.latestMessageDirection !== 'outbound') {
      return 'Última mensagem não foi do agente; a contagem para resposta do cliente não começou.';
    }

    const now = context.now ?? new Date();
    const elapsedMinutes = Math.floor((now.getTime() - context.ticket.latestMessageCreatedAt.getTime()) / 60_000);
    const remainingMinutes = Math.max(0, expectedMinutes - elapsedMinutes);

    if (remainingMinutes > 0) {
      return expectedPendingFrom === 'agent'
        ? `Ainda faltam ${remainingMinutes} min para cobrar resposta do agente.`
        : `Ainda faltam ${remainingMinutes} min para cobrar resposta do cliente.`;
    }

    return 'Tempo mínimo de inatividade ainda não foi atendido.';
  }

  return condition.valueLabel
    ? `Condição "${condition.valueLabel}" não foi atendida.`
    : `Condição "${condition.field}" não foi atendida.`;
}

function asActions(value: Prisma.JsonValue): AutomationAction[] {
  return Array.isArray(value) ? value as AutomationAction[] : [];
}

function asScheduleConfig(value: Prisma.JsonValue | null): ScheduleConfig | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ScheduleConfig : null;
}

function getSaoPauloParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: AUTOMATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dateKey: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${lookup.hour}:${lookup.minute}`,
    weekday: weekdayMap[lookup.weekday ?? 'Sun'] ?? 0,
  };
}

async function resolveAutomationActorUserId(app: FastifyInstance, automation: AutomationWithRuntime) {
  const preferredIds = [automation.updatedByUserId, automation.createdByUserId].filter((value): value is string => Boolean(value));

  if (preferredIds.length > 0) {
    const actor = await app.prisma.user.findFirst({
      where: {
        id: { in: preferredIds },
        status: 'active',
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });

    if (actor) {
      return actor.id;
    }
  }

  const fallback = await app.prisma.user.findFirst({
    where: { status: 'active' },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'asc' },
    ],
    select: { id: true },
  });

  return fallback?.id ?? null;
}

function evaluateCondition(
  condition: AutomationCondition,
  context: TriggerExecutionContext,
  conditions: AutomationCondition[] = [],
  actions: AutomationAction[] = [],
) {
  if (condition.field === 'message.keyword') {
    const messageBody = context.message?.body?.trim().toLowerCase() ?? '';
    const keyword = typeof condition.value === 'string' ? condition.value.trim().toLowerCase() : '';
    if (!keyword) {
      return true;
    }

    if (condition.operator === 'contains') {
      return messageBody.includes(keyword);
    }

    return false;
  }

  if (condition.field === 'ticket.assignment') {
    const expected = typeof condition.value === 'string' ? condition.value : 'any';
    if (expected === 'any') {
      return true;
    }

    if (expected === 'assigned') {
      return Boolean(context.ticket.currentAgentId);
    }

    if (expected === 'unassigned') {
      return !context.ticket.currentAgentId;
    }

    return false;
  }

  if (condition.field === 'ticket.inactivityMinutes') {
    const expectedMinutes = Number(condition.value);
    if (!Number.isFinite(expectedMinutes) || expectedMinutes <= 0) {
      return false;
    }

    if (!context.ticket.latestMessageCreatedAt) {
      return false;
    }

    const expectedPendingFrom = getTicketResponsePendingFrom(conditions, actions);
    const messageDirectionMatches = expectedPendingFrom === 'customer'
      ? context.ticket.latestMessageDirection === 'outbound'
      : context.ticket.latestMessageDirection === 'inbound';

    if (!messageDirectionMatches) {
      return false;
    }

    if (expectedPendingFrom === 'agent' && !context.ticket.currentAgentId) {
      return false;
    }

    const now = context.now ?? new Date();
    const elapsedMinutes = Math.floor((now.getTime() - context.ticket.latestMessageCreatedAt.getTime()) / 60_000);
    return elapsedMinutes >= expectedMinutes;
  }

  if (condition.field === 'ticket.responsePendingFrom') {
    const expected = getTicketResponsePendingFrom([condition], actions);
    if (expected === 'agent') {
      return context.ticket.latestMessageDirection === 'inbound' && Boolean(context.ticket.currentAgentId);
    }

    return context.ticket.latestMessageDirection === 'outbound';
  }

  return true;
}

function automationMatchesScope(automation: AutomationWithRuntime, context: TriggerExecutionContext) {
  if (automation.queueId && automation.queueId !== context.ticket.currentQueueId) {
    return false;
  }

  if (automation.whatsappInstanceId && automation.whatsappInstanceId !== context.ticket.whatsappInstanceId) {
    return false;
  }

  return true;
}

function dedupeKeyForContext(
  automation: AutomationWithRuntime,
  context: TriggerExecutionContext,
  conditions: AutomationCondition[] = [],
  actions: AutomationAction[] = [],
) {
  if (context.triggerType === 'message_received') {
    return `${automation.id}:message:${context.message?.id ?? 'unknown'}`;
  }

  if (context.triggerType === 'ticket_created') {
    return `${automation.id}:ticket-created:${context.ticket.id}`;
  }

  if (context.triggerType === 'ticket_inactive') {
    const inactivityMinutes = getTicketInactivityMinutes(conditions) ?? 1;
    const latestMessageKey = context.ticket.latestMessageCreatedAt?.toISOString() ?? context.ticket.lastMessageAt.toISOString();
    const expectedPendingFrom = getTicketResponsePendingFrom(conditions, actions);
    const latestMessageAt = context.ticket.latestMessageCreatedAt ?? context.ticket.lastMessageAt;
    const now = context.now ?? new Date();
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - latestMessageAt.getTime()) / 60_000));
    const phase = elapsedMinutes >= inactivityMinutes ? 'threshold-reached' : `waiting:${elapsedMinutes}`;
    return `${automation.id}:inactive:${context.ticket.id}:${latestMessageKey}:${expectedPendingFrom}:${inactivityMinutes}:${phase}`;
  }

  const parts = getSaoPauloParts(context.now ?? new Date());
  return `${automation.id}:scheduled:${context.ticket.id}:${parts.dateKey}:${parts.time}`;
}

async function createAutomationExecution(
  app: FastifyInstance,
  params: {
    id?: string;
    automationId: string;
    dedupeKey?: string | null;
    status: 'success' | 'skipped' | 'failed';
    message: string;
    triggerPayload: Record<string, unknown>;
    resultPayload?: Record<string, unknown> | null;
  },
) {
  await app.prisma.automationExecution.create({
    data: {
      id: params.id ?? randomUUID(),
      automationId: params.automationId,
      dedupeKey: params.dedupeKey ?? null,
      status: params.status,
      message: params.message,
      triggerPayload: params.triggerPayload as Prisma.InputJsonValue,
      resultPayload: params.resultPayload ? params.resultPayload as Prisma.InputJsonValue : Prisma.JsonNull,
    },
  });
}

async function claimAutomationExecution(
  app: FastifyInstance,
  params: {
    automationId: string;
    dedupeKey: string;
    triggerPayload: Record<string, unknown>;
  },
) {
  const executionId = randomUUID();

  try {
    await createAutomationExecution(app, {
      id: executionId,
      automationId: params.automationId,
      dedupeKey: params.dedupeKey,
      status: 'skipped',
      message: 'Execucao reservada para processamento.',
      triggerPayload: params.triggerPayload,
      resultPayload: null,
    });
    return executionId;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return null;
    }

    throw error;
  }
}

async function finalizeAutomationExecution(
  app: FastifyInstance,
  params: {
    id: string;
    status: 'success' | 'skipped' | 'failed';
    message: string;
    resultPayload?: Record<string, unknown> | null;
  },
) {
  await app.prisma.automationExecution.update({
    where: { id: params.id },
    data: {
      status: params.status,
      message: params.message,
      resultPayload: params.resultPayload ? params.resultPayload as Prisma.InputJsonValue : Prisma.JsonNull,
    },
  });
}

async function executeAction(
  app: FastifyInstance,
  params: {
    automation: AutomationWithRuntime;
    action: AutomationAction;
    context: TriggerExecutionContext;
    actorUserId: string | null;
  },
) {
  const ticket = params.context.ticket;

  if (params.action.type === 'send_message') {
    const message = typeof params.action.config?.message === 'string' ? params.action.config.message.trim() : '';
    if (!message) {
      throw new Error('Ação de envio sem conteúdo.');
    }

    if (!params.actorUserId) {
      throw new Error('Nenhum usuário ativo disponível para enviar a mensagem automática.');
    }

    const outbound = await deliverOutboundMessage(app, {
      ticketId: ticket.id,
      actorUserId: params.actorUserId,
      body: message,
      preserveCurrentAgent: true,
      preserveCurrentStatus: true,
    });

    return {
      type: 'send_message',
      messageId: outbound.message.id,
      summary: params.action.summary ?? `Mensagem enviada para ${ticket.customerNameSnapshot}`,
    };
  }

  if (params.action.type === 'transfer_queue') {
    const queueId = typeof params.action.config?.queueId === 'string' ? params.action.config.queueId : null;
    if (!queueId) {
      throw new Error('Ação de transferência sem fila de destino.');
    }

    const updatedTicket = await app.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        currentQueueId: queueId,
        currentAgentId: null,
        status: 'pending',
      },
    });

    await app.prisma.ticketAssignment.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        fromAgentId: ticket.currentAgentId,
        toAgentId: null,
        fromQueueId: ticket.currentQueueId,
        toQueueId: queueId,
        reason: params.action.summary ?? 'Transferência automática de automação',
        createdByUserId: params.actorUserId,
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'transferred',
        actorUserId: params.actorUserId,
        metadata: {
          source: 'automation',
          automationId: params.automation.id,
          fromAgentId: ticket.currentAgentId,
          toAgentId: null,
          fromQueueId: ticket.currentQueueId,
          toQueueId: queueId,
        },
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: updatedTicket.id,
      status: updatedTicket.status,
      currentAgentId: updatedTicket.currentAgentId,
      currentQueueId: updatedTicket.currentQueueId,
    });

    return {
      type: 'transfer_queue',
      queueId,
      summary: params.action.summary ?? 'Ticket transferido automaticamente',
    };
  }

  if (params.action.type === 'assign_agent') {
    const agentId = typeof params.action.config?.agentId === 'string' ? params.action.config.agentId : null;
    if (!agentId) {
      throw new Error('Ação de atribuição sem agente de destino.');
    }

    const updatedTicket = await app.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        currentAgentId: agentId,
        status: 'open',
      },
    });

    await app.prisma.ticketAssignment.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        fromAgentId: ticket.currentAgentId,
        toAgentId: agentId,
        fromQueueId: ticket.currentQueueId,
        toQueueId: ticket.currentQueueId,
        reason: params.action.summary ?? 'Atribuição automática de automação',
        createdByUserId: params.actorUserId,
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'assigned',
        actorUserId: params.actorUserId,
        metadata: {
          source: 'automation',
          automationId: params.automation.id,
          fromAgentId: ticket.currentAgentId,
          toAgentId: agentId,
        },
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: updatedTicket.id,
      status: updatedTicket.status,
      currentAgentId: updatedTicket.currentAgentId,
      currentQueueId: updatedTicket.currentQueueId,
    });

    return {
      type: 'assign_agent',
      agentId,
      summary: params.action.summary ?? 'Ticket atribuído automaticamente',
    };
  }

  if (params.action.type === 'close_ticket') {
    const reason = typeof params.action.config?.reason === 'string' && params.action.config.reason.trim()
      ? params.action.config.reason.trim()
      : 'Encerrado automaticamente por automação';

    const updatedTicket = await app.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'closed',
        closedReason: reason,
        closedAt: new Date(),
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'closed',
        actorUserId: params.actorUserId,
        metadata: {
          source: 'automation',
          automationId: params.automation.id,
          reason,
        },
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: updatedTicket.id,
      status: updatedTicket.status,
      currentAgentId: updatedTicket.currentAgentId,
      currentQueueId: updatedTicket.currentQueueId,
    });

    return {
      type: 'close_ticket',
      reason,
      summary: params.action.summary ?? 'Ticket encerrado automaticamente',
    };
  }

  if (params.action.type === 'nudge_ticket') {
    if (!ticket.currentAgentId) {
      throw new Error('Ação de chamar atenção exige um ticket com responsável.');
    }

    if (params.actorUserId && ticket.currentAgentId === params.actorUserId) {
      throw new Error('A automação não pode chamar a atenção do mesmo usuário responsável pelo ticket.');
    }

    const actorUser = params.actorUserId
      ? await app.prisma.user.findUnique({
          where: { id: params.actorUserId },
          select: {
            email: true,
            agent: {
              select: {
                name: true,
              },
            },
          },
        })
      : null;
    const actorName = actorUser?.agent?.name ?? actorUser?.email ?? 'Sistema';

    const nudgeEvent = await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'nudged',
        actorUserId: params.actorUserId,
        metadata: {
          source: 'automation',
          automationId: params.automation.id,
          targetAgentId: ticket.currentAgentId,
          note: null,
        },
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: ticket.id,
      status: ticket.status,
      currentAgentId: ticket.currentAgentId,
      currentQueueId: ticket.currentQueueId,
    });
    app.io.emit('ticket.nudged', {
      ticketId: ticket.id,
      targetUserId: ticket.currentAgentId,
      actorUserId: params.actorUserId,
      actorName,
      customerName: ticket.customerNameSnapshot,
      createdAt: nudgeEvent.createdAt,
      note: null,
    });

    return {
      type: 'nudge_ticket',
      targetUserId: ticket.currentAgentId,
      summary: params.action.summary ?? 'Responsável alertado automaticamente',
    };
  }

  if (params.action.type === 'webhook') {
    const url = typeof params.action.config?.url === 'string' ? params.action.config.url.trim() : '';
    if (!url) {
      throw new Error('Ação de webhook sem URL.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          automation: {
            id: params.automation.id,
            name: params.automation.name,
            triggerType: params.automation.triggerType,
          },
          trigger: params.context.triggerType,
          ticket: params.context.ticket,
          message: params.context.message
            ? {
                ...params.context.message,
                hasAttachments: (params.context.message.attachments?.length ?? 0) > 0,
                primaryAttachment: params.context.message.attachments?.[0] ?? null,
              }
            : null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody = (await response.text().catch(() => '')).trim();
        const snippet = responseBody.slice(0, 300);
        throw new Error(
          snippet
            ? `Webhook respondeu ${response.status}: ${snippet}`
            : `Webhook respondeu ${response.status}.`,
        );
      }

      return {
        type: 'webhook',
        statusCode: response.status,
        summary: params.action.summary ?? `Webhook executado (${response.status})`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Ação de automação não suportada: ${params.action.type}`);
}

async function runAutomationAgainstContext(
  app: FastifyInstance,
  automation: AutomationWithRuntime,
  context: TriggerExecutionContext,
) {
  if (!automationMatchesScope(automation, context)) {
    return null;
  }

  const conditions = asConditions(automation.conditions);
  const actions = asActions(automation.actions);
  const dedupeKey = dedupeKeyForContext(automation, context, conditions, actions);
  if (!registerAutomationDedupe(dedupeKey, context.triggerType === 'scheduled_time' ? AUTOMATION_TICK_INTERVAL_MS + 5_000 : 60 * 60 * 1000)) {
    return null;
  }

  const triggerPayload = {
    triggerType: context.triggerType,
    ticketId: context.ticket.id,
    messageId: context.message?.id ?? null,
    dedupeKey,
  };
  const executionId = await claimAutomationExecution(app, {
    automationId: automation.id,
    dedupeKey,
    triggerPayload,
  });

  if (!executionId) {
    return null;
  }

  const failedConditions = conditions
    .filter((condition) => !evaluateCondition(condition, context, conditions, actions))
    .map((condition) => ({
      field: condition.field,
      message: formatConditionFailure(condition, context, conditions, actions),
    }));
  const conditionsMatched = failedConditions.length === 0;
  if (!conditionsMatched) {
    await finalizeAutomationExecution(app, {
      id: executionId,
      status: 'skipped',
      message: failedConditions[0]?.message ?? 'Condições não atendidas para este evento.',
      resultPayload: {
        ticketId: context.ticket.id,
        messageId: context.message?.id ?? null,
        failedConditions,
      },
    });
    return null;
  }

  const actorUserId = await resolveAutomationActorUserId(app, automation);

  try {
    const results: Array<Record<string, unknown>> = [];
    for (const action of actions) {
      results.push(await executeAction(app, {
        automation,
        action,
        context,
        actorUserId,
      }));
    }

    await finalizeAutomationExecution(app, {
      id: executionId,
      status: 'success',
      message: `${results.length} ação(ões) executada(s) com sucesso.`,
      resultPayload: {
        ticketId: context.ticket.id,
        actorUserId,
        actions: results,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao executar automação.';
    await finalizeAutomationExecution(app, {
      id: executionId,
      status: 'failed',
      message,
      resultPayload: {
        ticketId: context.ticket.id,
        actorUserId,
      },
    });
    app.log.error({
      action: 'automation_execution_failed',
      automationId: automation.id,
      ticketId: context.ticket.id,
      triggerType: context.triggerType,
      error,
    }, 'Falha ao executar automação.');
  }
}

async function loadActiveAutomations(
  app: FastifyInstance,
  triggerType: AutomationWithRuntime['triggerType'],
) {
  return app.prisma.automation.findMany({
    where: {
      status: 'active',
      triggerType,
    },
    select: {
      id: true,
      name: true,
      triggerType: true,
      status: true,
      queueId: true,
      whatsappInstanceId: true,
      createdByUserId: true,
      updatedByUserId: true,
      conditions: true,
      actions: true,
      scheduleConfig: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}

export async function processAutomationMessageReceived(
  app: FastifyInstance,
  params: {
    ticketId: string;
    messageId: string;
  },
) {
  const [ticket, message, automations] = await Promise.all([
    app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: {
        id: true,
        status: true,
        currentAgentId: true,
        currentAgent: {
          select: {
            name: true,
          },
        },
        currentQueueId: true,
        currentQueue: {
          select: {
            name: true,
          },
        },
        whatsappInstanceId: true,
        whatsappInstance: {
          select: {
            name: true,
            baseUrl: true,
            apiKeyEncrypted: true,
            evolutionInstanceName: true,
          },
        },
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            direction: true,
            senderAgentId: true,
            createdAt: true,
          },
        },
        createdAt: true,
        customerNameSnapshot: true,
        externalChatId: true,
        externalContactId: true,
        isGroup: true,
      },
    }),
    app.prisma.ticketMessage.findUnique({
      where: { id: params.messageId },
      select: {
        id: true,
        direction: true,
        contentType: true,
        body: true,
        senderNameSnapshot: true,
        externalMessageId: true,
        createdAt: true,
        attachments: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            publicUrl: true,
          },
        },
      },
    }),
    loadActiveAutomations(app, 'message_received'),
  ]);

  if (!ticket || !message || message.direction !== 'inbound' || ticket.isGroup) {
    return;
  }

  const ticketContext: AutomationTicketContext = {
    id: ticket.id,
    status: ticket.status,
    currentAgentId: ticket.currentAgentId,
    currentAgentName: ticket.currentAgent?.name ?? null,
    currentQueueId: ticket.currentQueueId,
    currentQueueName: ticket.currentQueue?.name ?? null,
    whatsappInstanceId: ticket.whatsappInstanceId,
    whatsappInstanceName: ticket.whatsappInstance.name ?? null,
    lastMessageAt: ticket.lastMessageAt,
    latestMessageDirection: ticket.messages[0]?.direction ?? null,
    latestMessageCreatedAt: ticket.messages[0]?.createdAt ?? null,
    latestMessageSenderAgentId: ticket.messages[0]?.senderAgentId ?? null,
    createdAt: ticket.createdAt,
    customerNameSnapshot: ticket.customerNameSnapshot,
    externalChatId: ticket.externalChatId,
    externalContactId: ticket.externalContactId,
    isGroup: ticket.isGroup,
  };

  const shouldEmbedAttachmentBase64 = automations.some((automation) =>
    asActions(automation.actions).some((action) => action.type === 'webhook'),
  );

  const messageAttachments = await Promise.all(
    message.attachments.map(async (attachment) => {
      const dataUrl = shouldEmbedAttachmentBase64
        ? await resolveAutomationAttachmentDataUrl({
            ticket: {
              externalChatId: ticket.externalChatId,
              whatsappInstance: {
                baseUrl: ticket.whatsappInstance.baseUrl,
                apiKeyEncrypted: ticket.whatsappInstance.apiKeyEncrypted,
                evolutionInstanceName: ticket.whatsappInstance.evolutionInstanceName,
              },
            },
            message: {
              externalMessageId: message.externalMessageId,
              direction: message.direction,
            },
            attachment: {
              publicUrl: attachment.publicUrl,
              mimeType: attachment.mimeType,
            },
          })
        : null;
      const parsedDataUrl = dataUrl ? parseDataUrl(dataUrl) : null;

      const attachmentContext: AutomationMessageAttachmentContext = {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: parsedDataUrl?.mimeType || attachment.mimeType,
        sizeBytes: typeof attachment.sizeBytes === 'bigint' ? Number(attachment.sizeBytes) : attachment.sizeBytes,
        publicUrl: attachment.publicUrl,
        contentUrl: `${env.WEB_APP_URL.replace(/\/$/, '')}/api/tickets/${ticket.id}/attachments/${attachment.id}/content`,
        dataUrl,
        base64: parsedDataUrl?.base64 ?? null,
        encoding: parsedDataUrl ? 'base64' : null,
      };

      return attachmentContext;
    }),
  );

  const messageContext: AutomationMessageContext = {
    id: message.id,
    direction: message.direction,
    contentType: message.contentType,
    body: message.body,
    senderName: message.senderNameSnapshot,
    externalMessageId: message.externalMessageId,
    createdAt: message.createdAt,
    attachments: messageAttachments,
  };

  for (const automation of automations) {
    await runAutomationAgainstContext(app, automation, {
      triggerType: 'message_received',
      ticket: ticketContext,
      message: messageContext,
      now: new Date(),
    });
  }
}

export async function runAutomationMaintenance(app: FastifyInstance) {
  const now = new Date();
  const [ticketCreatedAutomations, inactiveAutomations, scheduledAutomations] = await Promise.all([
    loadActiveAutomations(app, 'ticket_created'),
    loadActiveAutomations(app, 'ticket_inactive'),
    loadActiveAutomations(app, 'scheduled_time'),
  ]);

  if (ticketCreatedAutomations.length > 0) {
    const recentTickets = await app.prisma.ticket.findMany({
      where: {
        createdAt: {
          gte: new Date(now.getTime() - 2 * AUTOMATION_TICK_INTERVAL_MS),
        },
        isGroup: false,
      },
      select: {
        id: true,
        status: true,
        currentAgentId: true,
        currentQueueId: true,
        whatsappInstanceId: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            direction: true,
            senderAgentId: true,
            createdAt: true,
          },
        },
        createdAt: true,
        customerNameSnapshot: true,
        externalChatId: true,
        externalContactId: true,
        isGroup: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    for (const ticket of recentTickets) {
      for (const automation of ticketCreatedAutomations) {
        await runAutomationAgainstContext(app, automation, {
          triggerType: 'ticket_created',
          ticket: {
            ...ticket,
            latestMessageDirection: ticket.messages[0]?.direction ?? null,
            latestMessageCreatedAt: ticket.messages[0]?.createdAt ?? null,
            latestMessageSenderAgentId: ticket.messages[0]?.senderAgentId ?? null,
          },
          now,
        });
      }
    }
  }

  if (inactiveAutomations.length > 0) {
    const inactiveTickets = await app.prisma.ticket.findMany({
      where: {
        status: {
          in: ['open', 'pending'],
        },
        isGroup: false,
      },
      select: {
        id: true,
        status: true,
        currentAgentId: true,
        currentQueueId: true,
        whatsappInstanceId: true,
        lastMessageAt: true,
        messages: {
          where: {
            direction: { in: ['inbound', 'outbound'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            direction: true,
            senderAgentId: true,
            createdAt: true,
          },
        },
        createdAt: true,
        customerNameSnapshot: true,
        externalChatId: true,
        externalContactId: true,
        isGroup: true,
      },
      orderBy: {
        lastMessageAt: 'asc',
      },
    });

    for (const ticket of inactiveTickets) {
      for (const automation of inactiveAutomations) {
        await runAutomationAgainstContext(app, automation, {
          triggerType: 'ticket_inactive',
          ticket: {
            ...ticket,
            latestMessageDirection: ticket.messages[0]?.direction ?? null,
            latestMessageCreatedAt: ticket.messages[0]?.createdAt ?? null,
            latestMessageSenderAgentId: ticket.messages[0]?.senderAgentId ?? null,
          },
          now,
        });
      }
    }
  }

  if (scheduledAutomations.length > 0) {
    const parts = getSaoPauloParts(now);
    const scheduledTickets = await app.prisma.ticket.findMany({
      where: {
        status: {
          in: ['open', 'pending'],
        },
        isGroup: false,
      },
      select: {
        id: true,
        status: true,
        currentAgentId: true,
        currentQueueId: true,
        whatsappInstanceId: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            direction: true,
            senderAgentId: true,
            createdAt: true,
          },
        },
        createdAt: true,
        customerNameSnapshot: true,
        externalChatId: true,
        externalContactId: true,
        isGroup: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    for (const automation of scheduledAutomations) {
      const schedule = asScheduleConfig(automation.scheduleConfig);
      if (!schedule?.time || schedule.time !== parts.time) {
        continue;
      }

      if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(parts.weekday)) {
        continue;
      }

      for (const ticket of scheduledTickets) {
        await runAutomationAgainstContext(app, automation, {
          triggerType: 'scheduled_time',
          ticket: {
            ...ticket,
            latestMessageDirection: ticket.messages[0]?.direction ?? null,
            latestMessageCreatedAt: ticket.messages[0]?.createdAt ?? null,
            latestMessageSenderAgentId: ticket.messages[0]?.senderAgentId ?? null,
          },
          now,
        });
      }
    }
  }
}
