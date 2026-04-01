import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { deliverOutboundMessage } from './outbound-messages.js';

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
  currentQueueId: string | null;
  whatsappInstanceId: string;
  lastMessageAt: Date;
  createdAt: Date;
  customerNameSnapshot: string;
  externalChatId: string;
  externalContactId: string | null;
  isGroup: boolean;
};

type AutomationMessageContext = {
  id: string;
  direction: string;
  body: string | null;
  createdAt: Date;
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

function evaluateCondition(condition: AutomationCondition, context: TriggerExecutionContext) {
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

    const now = context.now ?? new Date();
    const elapsedMinutes = Math.floor((now.getTime() - context.ticket.lastMessageAt.getTime()) / 60_000);
    return elapsedMinutes >= expectedMinutes;
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

function dedupeKeyForContext(automation: AutomationWithRuntime, context: TriggerExecutionContext) {
  if (context.triggerType === 'message_received') {
    return `${automation.id}:message:${context.message?.id ?? 'unknown'}`;
  }

  if (context.triggerType === 'ticket_created') {
    return `${automation.id}:ticket-created:${context.ticket.id}`;
  }

  if (context.triggerType === 'ticket_inactive') {
    return `${automation.id}:inactive:${context.ticket.id}:${context.ticket.lastMessageAt.toISOString()}`;
  }

  const parts = getSaoPauloParts(context.now ?? new Date());
  return `${automation.id}:scheduled:${context.ticket.id}:${parts.dateKey}:${parts.time}`;
}

async function createAutomationExecution(
  app: FastifyInstance,
  params: {
    automationId: string;
    status: 'success' | 'skipped' | 'failed';
    message: string;
    triggerPayload: Record<string, unknown>;
    resultPayload?: Record<string, unknown> | null;
  },
) {
  await app.prisma.automationExecution.create({
    data: {
      id: randomUUID(),
      automationId: params.automationId,
      status: params.status,
      message: params.message,
      triggerPayload: params.triggerPayload as Prisma.InputJsonValue,
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
          message: params.context.message ?? null,
        }),
        signal: controller.signal,
      });

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

  const dedupeKey = dedupeKeyForContext(automation, context);
  if (!registerAutomationDedupe(dedupeKey, context.triggerType === 'scheduled_time' ? AUTOMATION_TICK_INTERVAL_MS + 5_000 : 60 * 60 * 1000)) {
    return null;
  }

  const conditions = asConditions(automation.conditions);
  const actions = asActions(automation.actions);
  const triggerPayload = {
    triggerType: context.triggerType,
    ticketId: context.ticket.id,
    messageId: context.message?.id ?? null,
    dedupeKey,
  };

  const conditionsMatched = conditions.every((condition) => evaluateCondition(condition, context));
  if (!conditionsMatched) {
    await createAutomationExecution(app, {
      automationId: automation.id,
      status: 'skipped',
      message: 'Condições não atendidas para este evento.',
      triggerPayload,
      resultPayload: {
        ticketId: context.ticket.id,
        messageId: context.message?.id ?? null,
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

    await createAutomationExecution(app, {
      automationId: automation.id,
      status: 'success',
      message: `${results.length} ação(ões) executada(s) com sucesso.`,
      triggerPayload,
      resultPayload: {
        ticketId: context.ticket.id,
        actorUserId,
        actions: results,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao executar automação.';
    await createAutomationExecution(app, {
      automationId: automation.id,
      status: 'failed',
      message,
      triggerPayload,
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
        currentQueueId: true,
        whatsappInstanceId: true,
        lastMessageAt: true,
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
        body: true,
        createdAt: true,
      },
    }),
    loadActiveAutomations(app, 'message_received'),
  ]);

  if (!ticket || !message || message.direction !== 'inbound' || ticket.isGroup) {
    return;
  }

  for (const automation of automations) {
    await runAutomationAgainstContext(app, automation, {
      triggerType: 'message_received',
      ticket,
      message,
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
          ticket,
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
          ticket,
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
          ticket,
          now,
        });
      }
    }
  }
}
