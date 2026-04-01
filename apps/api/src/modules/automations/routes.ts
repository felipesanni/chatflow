import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { requirePermission } from '../../lib/auth-guard.js';

const conditionSchema = z.object({
  field: z.string().trim().min(1, 'Informe a condição.'),
  operator: z.string().trim().min(1, 'Informe o operador da condição.'),
  value: z.any().optional(),
  valueLabel: z.string().trim().optional(),
});

const actionSchema = z.object({
  type: z.string().trim().min(1, 'Informe a ação.'),
  config: z.record(z.string(), z.any()).optional().default({}),
  summary: z.string().trim().optional(),
});

const scheduleConfigSchema = z.object({
  time: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Informe um horário válido no formato HH:mm.').optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
});

const automationPayloadSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da automação.'),
  description: z.string().trim().max(300).optional().nullable().or(z.literal('')),
  status: z.enum(['draft', 'active', 'inactive']).default('draft'),
  triggerType: z.enum(['message_received', 'ticket_created', 'ticket_inactive', 'scheduled_time']),
  queueId: z.string().uuid().optional().nullable(),
  whatsappInstanceId: z.string().uuid().optional().nullable(),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1, 'Adicione pelo menos uma ação.'),
  scheduleConfig: scheduleConfigSchema.optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.triggerType === 'ticket_inactive') {
    const inactivityCondition = value.conditions.find((condition) => condition.field === 'ticket.inactivityMinutes');
    if (!inactivityCondition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conditions'],
        message: 'Defina a condição de inatividade em minutos para este gatilho.',
      });
    }
  }

  if (value.triggerType === 'scheduled_time' && !value.scheduleConfig?.time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduleConfig', 'time'],
      message: 'Informe o horário para a automação agendada.',
    });
  }
});

const automationParamsSchema = z.object({
  automationId: z.string().uuid(),
});

function toInputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function mapAutomation(item: {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'inactive';
  triggerType: 'message_received' | 'ticket_created' | 'ticket_inactive' | 'scheduled_time';
  queueId: string | null;
  whatsappInstanceId: string | null;
  conditions: Prisma.JsonValue;
  actions: Prisma.JsonValue;
  scheduleConfig: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: { id: string; email: string; agent: { name: string } | null } | null;
  updatedByUser: { id: string; email: string; agent: { name: string } | null } | null;
  queue: { id: string; name: string; color: string | null } | null;
  whatsappInstance: { id: string; name: string } | null;
  executions?: Array<{ id: string; status: 'success' | 'skipped' | 'failed'; executedAt: Date; message: string | null }>;
  _count?: { executions: number };
}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    status: item.status,
    triggerType: item.triggerType,
    queueId: item.queueId,
    whatsappInstanceId: item.whatsappInstanceId,
    conditions: Array.isArray(item.conditions) ? item.conditions : [],
    actions: Array.isArray(item.actions) ? item.actions : [],
    scheduleConfig: item.scheduleConfig && typeof item.scheduleConfig === 'object' && !Array.isArray(item.scheduleConfig) ? item.scheduleConfig : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: item.createdByUser
      ? {
          id: item.createdByUser.id,
          name: item.createdByUser.agent?.name ?? item.createdByUser.email,
        }
      : null,
    updatedBy: item.updatedByUser
      ? {
          id: item.updatedByUser.id,
          name: item.updatedByUser.agent?.name ?? item.updatedByUser.email,
        }
      : null,
    queue: item.queue,
    whatsappInstance: item.whatsappInstance,
    executionCount: item._count?.executions ?? 0,
    latestExecution: item.executions?.[0]
      ? {
          id: item.executions[0].id,
          status: item.executions[0].status,
          executedAt: item.executions[0].executedAt,
          message: item.executions[0].message,
        }
      : null,
  };
}

function mapExecution(item: {
  id: string;
  status: 'success' | 'skipped' | 'failed';
  message: string | null;
  triggerPayload: Prisma.JsonValue | null;
  resultPayload: Prisma.JsonValue | null;
  executedAt: Date;
  automation: { id: string; name: string; status: 'draft' | 'active' | 'inactive'; triggerType: 'message_received' | 'ticket_created' | 'ticket_inactive' | 'scheduled_time' };
}) {
  return {
    id: item.id,
    status: item.status,
    message: item.message,
    triggerPayload: item.triggerPayload,
    resultPayload: item.resultPayload,
    executedAt: item.executedAt,
    automation: item.automation,
  };
}

export const automationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/automations', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'automations.view');
    if (!access) return;

    const items = await app.prisma.automation.findMany({
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
            agent: { select: { name: true } },
          },
        },
        updatedByUser: {
          select: {
            id: true,
            email: true,
            agent: { select: { name: true } },
          },
        },
        queue: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            executedAt: true,
            message: true,
          },
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });

    return {
      items: items.map((item) => mapAutomation(item)),
    };
  });

  app.get('/automations/executions', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'automations.view');
    if (!access) return;

    const items = await app.prisma.automationExecution.findMany({
      orderBy: { executedAt: 'desc' },
      take: 50,
      include: {
        automation: {
          select: {
            id: true,
            name: true,
            status: true,
            triggerType: true,
          },
        },
      },
    });

    return {
      items: items.map((item) => mapExecution(item)),
    };
  });

  app.post('/automations', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'automations.manage');
    if (!access) return;

    const body = automationPayloadSchema.parse(request.body);

    const created = await app.prisma.automation.create({
      data: {
        id: randomUUID(),
        name: body.name,
        description: body.description?.trim() || null,
        status: body.status,
        triggerType: body.triggerType,
        queueId: body.queueId || null,
        whatsappInstanceId: body.whatsappInstanceId || null,
        conditions: toInputJson(body.conditions),
        actions: toInputJson(body.actions),
        scheduleConfig: body.scheduleConfig ? toInputJson(body.scheduleConfig) : Prisma.JsonNull,
        createdByUserId: access.session.userId,
        updatedByUserId: access.session.userId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
            agent: { select: { name: true } },
          },
        },
        updatedByUser: {
          select: {
            id: true,
            email: true,
            agent: { select: { name: true } },
          },
        },
        queue: { select: { id: true, name: true, color: true } },
        whatsappInstance: { select: { id: true, name: true } },
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            executedAt: true,
            message: true,
          },
        },
        _count: { select: { executions: true } },
      },
    });

    return reply.code(201).send({
      item: mapAutomation(created),
    });
  });

  app.put('/automations/:automationId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'automations.manage');
    if (!access) return;

    const params = automationParamsSchema.parse(request.params);
    const body = automationPayloadSchema.parse(request.body);

    const existing = await app.prisma.automation.findUnique({
      where: { id: params.automationId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Automação não encontrada.');
    }

    const updated = await app.prisma.automation.update({
      where: { id: params.automationId },
      data: {
        name: body.name,
        description: body.description?.trim() || null,
        status: body.status,
        triggerType: body.triggerType,
        queueId: body.queueId || null,
        whatsappInstanceId: body.whatsappInstanceId || null,
        conditions: toInputJson(body.conditions),
        actions: toInputJson(body.actions),
        scheduleConfig: body.scheduleConfig ? toInputJson(body.scheduleConfig) : Prisma.JsonNull,
        updatedByUserId: access.session.userId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
            agent: { select: { name: true } },
          },
        },
        updatedByUser: {
          select: {
            id: true,
            email: true,
            agent: { select: { name: true } },
          },
        },
        queue: { select: { id: true, name: true, color: true } },
        whatsappInstance: { select: { id: true, name: true } },
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            executedAt: true,
            message: true,
          },
        },
        _count: { select: { executions: true } },
      },
    });

    return {
      item: mapAutomation(updated),
    };
  });

  app.delete('/automations/:automationId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'automations.manage');
    if (!access) return;

    const params = automationParamsSchema.parse(request.params);

    const existing = await app.prisma.automation.findUnique({
      where: { id: params.automationId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Automação não encontrada.');
    }

    await app.prisma.automation.delete({
      where: { id: params.automationId },
    });

    return reply.code(204).send();
  });
};
