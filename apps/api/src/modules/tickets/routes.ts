import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requireSession } from '../../lib/auth-guard.js';

const ticketListQuerySchema = z.object({
  status: z.enum(['open', 'pending', 'closed']).optional(),
  agentId: z.string().uuid().optional(),
  queueId: z.string().uuid().optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ticketRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tickets', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const query = ticketListQuerySchema.parse(request.query);
    const items = await app.prisma.ticket.findMany({
      where: {
        status: query.status,
        currentAgentId: query.agentId,
        currentQueueId: query.queueId,
        OR: query.search
          ? [
              { customerNameSnapshot: { contains: query.search, mode: 'insensitive' } },
              { externalChatId: { contains: query.search, mode: 'insensitive' } },
              { lastMessagePreview: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        currentAgent: true,
        currentQueue: true,
        whatsappInstance: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: query.limit,
    });

    return {
      items: items.map((ticket: any) => ({
        id: ticket.id,
        status: ticket.status,
        customerName: ticket.customerNameSnapshot,
        externalChatId: ticket.externalChatId,
        lastMessagePreview: ticket.lastMessagePreview,
        unreadCount: ticket.unreadCount,
        currentAgent: ticket.currentAgent ? { id: ticket.currentAgent.id, name: ticket.currentAgent.name } : null,
        currentQueue: ticket.currentQueue ? { id: ticket.currentQueue.id, name: ticket.currentQueue.name } : null,
        whatsappInstance: { id: ticket.whatsappInstance.id, name: ticket.whatsappInstance.name },
        isGroup: ticket.isGroup,
        updatedAt: ticket.updatedAt,
      })),
      filters: query,
      viewer: {
        id: session.userId,
        role: session.role,
      },
    };
  });

  app.get('/tickets/:ticketId', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        customer: true,
        currentAgent: true,
        currentQueue: true,
        whatsappInstance: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket not found.');
    }

    return {
      item: {
        id: ticket.id,
        status: ticket.status,
        customerName: ticket.customerNameSnapshot,
        externalChatId: ticket.externalChatId,
        lastMessagePreview: ticket.lastMessagePreview,
        unreadCount: ticket.unreadCount,
        closedReason: ticket.closedReason,
        isGroup: ticket.isGroup,
        customer: ticket.customer,
        currentAgent: ticket.currentAgent,
        currentQueue: ticket.currentQueue,
        whatsappInstance: ticket.whatsappInstance,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
      viewer: {
        id: session.userId,
        role: session.role,
      },
    };
  });

  app.post('/tickets/:ticketId/accept', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);

    const ticket = await app.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        currentAgentId: session.userId,
        status: 'open',
        unreadCount: 0,
      },
      include: {
        currentAgent: true,
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'accepted',
        actorUserId: session.userId,
        metadata: { acceptedBy: session.userId },
      },
    });

    app.io.emit('ticket.updated', { ticketId: ticket.id, status: ticket.status, currentAgentId: ticket.currentAgentId });

    return {
      item: ticket,
    };
  });

  app.post('/tickets/:ticketId/close', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const parsedBody = z.object({ reason: z.string().min(1).optional() }).parse(request.body ?? {});
    const reason = parsedBody.reason ?? 'Encerrado pelo agente';

    const ticket = await app.prisma.ticket.update({
      where: { id: params.ticketId },
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
        actorUserId: session.userId,
        metadata: { reason },
      },
    });

    app.io.emit('ticket.closed', { ticketId: ticket.id });

    return {
      item: ticket,
    };
  });
};
