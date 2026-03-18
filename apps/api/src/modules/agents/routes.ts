import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { requireSession } from '../../lib/auth-guard.js';
import { hashPassword } from '../../lib/password.js';

const createAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'agent']).default('agent'),
  queueIds: z.array(z.string().uuid()).default([]),
});

const updateAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal('')),
  role: z.enum(['admin', 'agent']).default('agent'),
});

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/agents', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const items = await app.prisma.agent.findMany({
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
        name: agent.name,
        email: agent.user.email,
        role: agent.user.role,
        presence: agent.presence,
        queues: agent.queueLinks.map((link: any) => ({ id: link.queue.id, name: link.queue.name })),
        createdAt: agent.createdAt,
      })),
    };
  });

  app.post('/agents', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;
    if (session.role !== 'admin') {
      return reply.forbidden('Somente administradores podem criar agentes.');
    }

    const body = createAgentSchema.parse(request.body);
    const userId = randomUUID();

    await app.prisma.user.create({
      data: {
        id: userId,
        email: body.email.toLowerCase(),
        passwordHash: hashPassword(body.password),
        role: body.role,
        status: 'active',
        agent: {
          create: {
            name: body.name,
            presence: 'offline',
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
      return reply.internalServerError('Não foi possível persistir o usuário do agente.');
    }

    app.io.emit('agent.updated', { agentId: userId, action: 'created' });

    return reply.code(201).send({
      item: {
        id: userId,
        name: created.agent?.name ?? body.name,
        email: created.email,
        role: created.role,
        presence: created.agent?.presence ?? 'offline',
        queues: created.agent?.queueLinks.map((link: any) => ({ id: link.queue.id, name: link.queue.name })) ?? [],
      },
    });
  });

  app.put('/agents/:agentId', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;
    if (session.role !== 'admin') {
      return reply.forbidden('Somente administradores podem editar agentes.');
    }

    const params = z.object({ agentId: z.string().uuid() }).parse(request.params);
    const body = updateAgentSchema.parse(request.body);

    const existing = await app.prisma.agent.findUnique({
      where: { id: params.agentId },
      include: { user: true },
    });

    if (!existing) {
      return reply.notFound('Agente não encontrado.');
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
      return reply.conflict('Já existe outro usuário com este e-mail.');
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.user.id },
        data: {
          email: normalizedEmail,
          role: body.role,
          ...(body.password ? { passwordHash: hashPassword(body.password) } : {}),
        },
      });

      await tx.agent.update({
        where: { id: params.agentId },
        data: {
          name: body.name,
        },
      });
    });

    app.io.emit('agent.updated', { agentId: params.agentId, action: 'updated' });

    return reply.code(200).send({
      message: 'Agente atualizado com sucesso.',
      item: {
        id: params.agentId,
        name: body.name,
        email: normalizedEmail,
        role: body.role,
      },
    });
  });
};
