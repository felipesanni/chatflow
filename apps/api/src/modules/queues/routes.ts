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
      items: items.map((queue) => ({
        id: queue.id,
        name: queue.name,
        color: queue.color,
        isActive: queue.isActive,
        openTicketCount: queue.tickets.length,
        agents: queue.queueAgents.map((link) => ({ id: link.agent.id, name: link.agent.name })),
      })),
    };
  });

  app.post('/queues', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;
    if (session.role !== 'admin') {
      return reply.forbidden('Only admins can create queues.');
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
      return reply.forbidden('Only admins can update queue members.');
    }

    const params = z.object({ queueId: z.string().uuid() }).parse(request.params);
    const body = assignQueueAgentsSchema.parse(request.body);

    await app.prisma.queueAgent.deleteMany({
      where: { queueId: params.queueId },
    });

    if (body.agentIds.length > 0) {
      await app.prisma.queueAgent.createMany({
        data: body.agentIds.map((agentId) => ({ queueId: params.queueId, agentId })),
      });
    }

    app.io.emit('queue.updated', { queueId: params.queueId, action: 'members_changed' });

    return reply.code(204).send();
  });
};
