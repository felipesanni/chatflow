import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';

const createQueueSchema = z.object({
  name: z.string().min(2),
  color: z.string().min(4).optional(),
});

const updateQueueSchema = z.object({
  name: z.string().min(2),
  color: z.string().min(4).optional(),
});

const assignQueueAgentsSchema = z.object({
  agentIds: z.array(z.string().uuid()),
});

export const queueRoutes: FastifyPluginAsync = async (app) => {
  app.get('/queues', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'team.view'))) return;

    const items = await app.prisma.queue.findMany({
      include: {
        queueAgents: {
          include: {
            agent: true,
          },
        },
        tickets: {
          where: { status: { in: ['open', 'pending'] } },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      items: items.map((queue: any) => ({
        id: queue.id,
        name: queue.name,
        color: queue.color,
        isActive: queue.isActive,
        openTicketCount: queue.tickets.length,
        agents: queue.queueAgents.map((link: any) => ({ id: link.agent.id, name: link.agent.name })),
      })),
    };
  });

  app.post('/queues', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'queues.manage'))) return;

    const body = createQueueSchema.parse(request.body);
    const item = await app.prisma.queue.create({
      data: {
        id: randomUUID(),
        name: body.name,
        color: body.color,
      },
    });

    app.io.emit('queue.updated', { queueId: item.id, action: 'created' });

    return reply.code(201).send({ item });
  });

  app.put('/queues/:queueId', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'queues.manage'))) return;

    const params = z.object({ queueId: z.string().uuid() }).parse(request.params);
    const body = updateQueueSchema.parse(request.body);

    const existing = await app.prisma.queue.findUnique({
      where: { id: params.queueId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Fila nao encontrada.');
    }

    const item = await app.prisma.queue.update({
      where: { id: params.queueId },
      data: {
        name: body.name,
        color: body.color,
      },
    });

    app.io.emit('queue.updated', { queueId: item.id, action: 'updated' });

    return reply.code(200).send({
      message: 'Fila atualizada com sucesso.',
      item,
    });
  });

  app.post('/queues/:queueId/agents', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'queues.assign'))) return;

    const params = z.object({ queueId: z.string().uuid() }).parse(request.params);
    const body = assignQueueAgentsSchema.parse(request.body);
    const uniqueAgentIds = [...new Set(body.agentIds)];

    const queue = await app.prisma.queue.findUnique({
      where: { id: params.queueId },
      select: { id: true, name: true },
    });

    if (!queue) {
      return reply.notFound('Fila nao encontrada.');
    }

    if (uniqueAgentIds.length > 0) {
      const existingAgents = await app.prisma.agent.findMany({
        where: {
          id: { in: uniqueAgentIds },
        },
        select: { id: true },
      });

      if (existingAgents.length !== uniqueAgentIds.length) {
        return reply.badRequest('Um ou mais agentes selecionados nao existem mais. Atualize a tela e tente novamente.');
      }
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.queueAgent.deleteMany({
        where: { queueId: params.queueId },
      });

      if (uniqueAgentIds.length > 0) {
        await tx.queueAgent.createMany({
          data: uniqueAgentIds.map((agentId) => ({ queueId: params.queueId, agentId })),
        });
      }
    });

    app.io.emit('queue.updated', { queueId: params.queueId, action: 'members_changed' });
    app.io.emit('agent.updated', { action: 'queue_members_changed' });

    return reply.code(200).send({
      message: 'Membros da fila atualizados com sucesso.',
      item: {
        id: queue.id,
        name: queue.name,
        agentIds: uniqueAgentIds,
      },
    });
  });
};
