import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requireSession } from '../../lib/auth-guard.js';

const createQueueSchema = z.object({
  name: z.string().min(2),
  color: z.string().min(4).optional(),
});

const assignQueueAgentsSchema = z.object({
  agentIds: z.array(z.string().uuid()),
});

export const queueRoutes: FastifyPluginAsync = async (app) => {
  app.get('/queues', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

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
    const session = requireSession(request, reply);
    if (!session) return;
    if (session.role !== 'admin') {
      return reply.forbidden('Somente administradores podem criar filas.');
    }

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

  app.post('/queues/:queueId/agents', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;
    if (session.role !== 'admin') {
      return reply.forbidden('Somente administradores podem atualizar os membros da fila.');
    }

    const params = z.object({ queueId: z.string().uuid() }).parse(request.params);
    const body = assignQueueAgentsSchema.parse(request.body);
    const uniqueAgentIds = [...new Set(body.agentIds)];

    const queue = await app.prisma.queue.findUnique({
      where: { id: params.queueId },
      select: { id: true, name: true },
    });

    if (!queue) {
      return reply.notFound('Fila não encontrada.');
    }

    if (uniqueAgentIds.length > 0) {
      const existingAgents = await app.prisma.agent.findMany({
        where: {
          id: { in: uniqueAgentIds },
        },
        select: { id: true },
      });

      if (existingAgents.length !== uniqueAgentIds.length) {
        return reply.badRequest('Um ou mais agentes selecionados não existem mais. Atualize a tela e tente novamente.');
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
