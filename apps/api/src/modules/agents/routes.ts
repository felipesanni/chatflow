import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';
import { hashPassword } from '../../lib/password.js';
import { defaultPermissionsForRole, permissionDefinitions, permissionsToJson, resolvePermissions, type PermissionKey } from '../../lib/permissions.js';

const accessTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Informe um horário válido no formato HH:mm.');

const createAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'agent']).default('agent'),
  queueIds: z.array(z.string().uuid()).default([]),
  permissions: z.record(z.string(), z.boolean()).optional(),
  isBotAgent: z.boolean().optional(),
  blocked: z.boolean().optional(),
  accessStartTime: z.union([accessTimeSchema, z.literal(''), z.null()]).optional(),
  accessEndTime: z.union([accessTimeSchema, z.literal(''), z.null()]).optional(),
}).superRefine((value, ctx) => {
  const hasStart = Boolean(value.accessStartTime);
  const hasEnd = Boolean(value.accessEndTime);

  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['accessStartTime'],
      message: 'Defina o horário inicial e final juntos.',
    });
  }

  if (value.accessStartTime && value.accessEndTime && value.accessStartTime === value.accessEndTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['accessEndTime'],
      message: 'O horário final precisa ser diferente do horário inicial.',
    });
  }
});

const updateAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal('')),
  role: z.enum(['admin', 'agent']).default('agent'),
  queueIds: z.array(z.string().uuid()).default([]),
  permissions: z.record(z.string(), z.boolean()).optional(),
  isBotAgent: z.boolean().optional(),
  blocked: z.boolean().optional(),
  accessStartTime: z.union([accessTimeSchema, z.literal(''), z.null()]).optional(),
  accessEndTime: z.union([accessTimeSchema, z.literal(''), z.null()]).optional(),
}).superRefine((value, ctx) => {
  const hasStart = Boolean(value.accessStartTime);
  const hasEnd = Boolean(value.accessEndTime);

  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['accessStartTime'],
      message: 'Defina o horário inicial e final juntos.',
    });
  }

  if (value.accessStartTime && value.accessEndTime && value.accessStartTime === value.accessEndTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['accessEndTime'],
      message: 'O horário final precisa ser diferente do horário inicial.',
    });
  }
});

const validPermissionKeys = new Set(permissionDefinitions.map((item) => item.key));

function sanitizePermissions(input: Record<string, boolean> | undefined, role: 'admin' | 'agent') {
  const normalized: Partial<Record<PermissionKey, boolean>> = {};

  for (const [key, value] of Object.entries(input ?? {})) {
    if (validPermissionKeys.has(key as PermissionKey) && typeof value === 'boolean') {
      normalized[key as PermissionKey] = value;
    }
  }

  return permissionsToJson(normalized, role);
}

function normalizeAccessWindow(startTime?: string | null, endTime?: string | null) {
  const normalizedStartTime = typeof startTime === 'string' && startTime.trim() ? startTime.trim() : null;
  const normalizedEndTime = typeof endTime === 'string' && endTime.trim() ? endTime.trim() : null;

  return {
    accessStartTime: normalizedStartTime,
    accessEndTime: normalizedEndTime,
  };
}

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/agents', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'team.view');
    if (!access) return;

    const canViewBotAgents = access.user.role === 'admin' || access.permissions['agents.viewBot'];

    const items = await app.prisma.agent.findMany({
      where: canViewBotAgents ? undefined : { isBotAgent: false },
      include: {
        user: true,
        queueLinks: {
          include: {
            queue: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

      return {
        items: items.map((agent: any) => ({
          id: agent.id,
          publicId: agent.publicId,
          name: agent.name,
        email: agent.user.email,
        role: agent.user.role,
        permissions: resolvePermissions(agent.user.role, agent.user.permissions),
        status: agent.user.status,
        accessStartTime: agent.user.accessStartTime,
        accessEndTime: agent.user.accessEndTime,
        isBotAgent: agent.isBotAgent,
        presence: agent.presence,
        queues: agent.queueLinks.map((link: any) => ({ id: link.queue.id, name: link.queue.name })),
        createdAt: agent.createdAt,
      })),
    };
  });

  app.post('/agents', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'agents.manage');
    if (!access) return;

    const body = createAgentSchema.parse(request.body);
    const normalizedPassword = body.password.trim();
    const userId = randomUUID();
    const accessWindow = normalizeAccessWindow(body.accessStartTime, body.accessEndTime);
    const isBotAgent = access.user.role === 'admin' ? body.isBotAgent === true : false;

    if (access.user.role !== 'admin' && (body.blocked || accessWindow.accessStartTime || accessWindow.accessEndTime)) {
      return reply.forbidden('Somente administradores podem bloquear usuários ou definir horários de acesso.');
    }

    await app.prisma.user.create({
      data: {
        id: userId,
        email: body.email.toLowerCase(),
        passwordHash: hashPassword(normalizedPassword),
        role: body.role,
        permissions: sanitizePermissions(body.permissions, body.role),
        status: body.blocked ? 'inactive' : 'active',
        accessStartTime: accessWindow.accessStartTime,
        accessEndTime: accessWindow.accessEndTime,
        agent: {
          create: {
            name: body.name,
            presence: 'offline',
            isBotAgent,
            queueLinks: {
              create: body.queueIds.map((queueId) => ({ queueId })),
            },
          },
        },
      },
    });

    const created = await app.prisma.user.findUnique({
      where: { id: userId },
      include: {
        agent: {
          include: {
            queueLinks: {
              include: { queue: true },
            },
          },
        },
      },
    });

    if (!created) {
      return reply.internalServerError('Nao foi possivel persistir o usuario do agente.');
    }

    app.io.emit('agent.updated', { agentId: userId, action: 'created' });

    return reply.code(201).send({
        item: {
          id: userId,
          publicId: created.agent?.publicId,
          name: created.agent?.name ?? body.name,
        email: created.email,
        role: created.role,
        permissions: resolvePermissions(created.role, created.permissions),
        status: created.status,
        accessStartTime: created.accessStartTime,
        accessEndTime: created.accessEndTime,
        isBotAgent: created.agent?.isBotAgent ?? isBotAgent,
        presence: created.agent?.presence ?? 'offline',
        queues: created.agent?.queueLinks.map((link: any) => ({ id: link.queue.id, name: link.queue.name })) ?? [],
      },
    });
  });

  app.put('/agents/:agentId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'agents.manage');
    if (!access) return;

    const params = z.object({ agentId: z.string().uuid() }).parse(request.params);
    const body = updateAgentSchema.parse(request.body);
    const normalizedPassword = body.password?.trim() ?? '';
    const accessWindow = normalizeAccessWindow(body.accessStartTime, body.accessEndTime);

    const existing = await app.prisma.agent.findUnique({
      where: { id: params.agentId },
      include: { user: true },
    });

    if (!existing) {
      return reply.notFound('Agente nao encontrado.');
    }

    const normalizedEmail = body.email.toLowerCase();
    const emailConflict = await app.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: existing.user.id },
      },
      select: { id: true },
    });

    if (emailConflict) {
      return reply.conflict('Ja existe outro usuario com este e-mail.');
    }

    if (normalizedPassword && !access.permissions['agents.password.manage']) {
      return reply.forbidden('Voce nao possui permissao para alterar senhas de usuarios.');
    }

    if (access.user.role !== 'admin' && (body.blocked !== undefined || accessWindow.accessStartTime || accessWindow.accessEndTime)) {
      return reply.forbidden('Somente administradores podem bloquear usuários ou definir horários de acesso.');
    }

    const nextStatus = access.user.role === 'admin'
      ? (body.blocked ? 'inactive' : 'active')
      : existing.user.status;
    const nextIsBotAgent = access.user.role === 'admin'
      ? body.isBotAgent === true
      : existing.isBotAgent;
    const nextAccessStartTime = access.user.role === 'admin'
      ? accessWindow.accessStartTime
      : existing.user.accessStartTime;
    const nextAccessEndTime = access.user.role === 'admin'
      ? accessWindow.accessEndTime
      : existing.user.accessEndTime;

    await app.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.user.id },
        data: {
          email: normalizedEmail,
          role: body.role,
          permissions: sanitizePermissions(body.permissions, body.role),
          status: nextStatus,
          accessStartTime: nextAccessStartTime,
          accessEndTime: nextAccessEndTime,
          ...(normalizedPassword ? { passwordHash: hashPassword(normalizedPassword) } : {}),
        },
      });

      await tx.agent.update({
        where: { id: params.agentId },
        data: {
          name: body.name,
          isBotAgent: nextIsBotAgent,
          queueLinks: {
            deleteMany: {},
            create: body.queueIds.map((queueId) => ({ queueId })),
          },
        },
      });
    });

    const updated = await app.prisma.agent.findUnique({
      where: { id: params.agentId },
      include: {
        queueLinks: {
          include: { queue: true },
        },
      },
    });

    app.io.emit('agent.updated', { agentId: params.agentId, action: 'updated' });

    return reply.code(200).send({
      message: 'Agente atualizado com sucesso.',
        item: {
          id: params.agentId,
          publicId: updated?.publicId,
          name: body.name,
        email: normalizedEmail,
        role: body.role,
        permissions: resolvePermissions(body.role, body.permissions ?? defaultPermissionsForRole(body.role)),
        status: nextStatus,
        accessStartTime: nextAccessStartTime,
        accessEndTime: nextAccessEndTime,
        isBotAgent: updated?.isBotAgent ?? nextIsBotAgent,
        queues: updated?.queueLinks.map((link: any) => ({ id: link.queue.id, name: link.queue.name })) ?? [],
      },
    });
  });

  app.delete('/agents/:agentId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'agents.delete');
    if (!access) return;

    const params = z.object({ agentId: z.string().uuid() }).parse(request.params);

    if (params.agentId === access.session.userId) {
      return reply.forbidden('Voce nao pode excluir o proprio usuario.');
    }

    const existing = await app.prisma.agent.findUnique({
      where: { id: params.agentId },
      include: { user: true },
    });

    if (!existing) {
      return reply.notFound('Agente nao encontrado.');
    }

    await app.prisma.user.delete({
      where: { id: existing.user.id },
    });

    app.io.emit('agent.updated', { agentId: params.agentId, action: 'deleted' });

    return reply.code(200).send({
      message: 'Agente excluido com sucesso.',
    });
  });
};
