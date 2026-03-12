import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requireSession } from '../../lib/auth-guard.js';
import { hashPassword } from '../../lib/password.js';

const createAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'agent']).default('agent'),
  queueIds: z.array(z.string().uuid()).default([]),
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
      return reply.forbidden('Only admins can create agents.');
    }

    const body = createAgentSchema.parse(request.body);
    const userId = randomUUID();

    const created = await app.prisma.user.create({
      data: {
        id: userId,
        email: body.email.toLowerCase(),
        passwordHash: hashPassword(body.password),
        role: body.role,
        status: 'active',
        agent: {
          create: {
            id: userId,
            name: body.name,
            presence: 'offline',
            queueLinks: {
              create: body.queueIds.map((queueId) => ({ queueId })),
            },
          },
        },
      },
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
};
