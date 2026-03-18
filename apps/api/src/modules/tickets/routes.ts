import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';

const ticketListQuerySchema = z.object({
  status: z.enum(['open', 'pending', 'closed']).optional(),
  agentId: z.string().uuid().optional(),
  queueId: z.string().uuid().optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const createTicketBodySchema = z.object({
  customerName: z.string().trim().min(1, 'Informe o nome do contato.'),
  phone: z.string().trim().min(8, 'Informe um telefone valido.'),
  whatsappInstanceId: z.string().uuid('Selecione uma instancia valida.'),
  queueId: z.string().uuid().optional().nullable(),
});

function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

function normalizeRemoteJid(phone: string) {
  return `${phone}@s.whatsapp.net`;
}

function serializeTicket(ticket: any) {
  return {
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
  };
}

export const ticketRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tickets', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

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
      items: items.map(serializeTicket),
      filters: query,
      viewer: {
        id: session.userId,
        role: session.role,
      },
    };
  });

  app.get('/tickets/:ticketId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

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
      return reply.notFound('Ticket nao encontrado.');
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

  app.post('/tickets', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const body = createTicketBodySchema.parse(request.body ?? {});
    const normalizedPhone = normalizePhone(body.phone);

    if (!normalizedPhone) {
      return reply.badRequest('Informe um telefone valido.');
    }

    const instance = await app.prisma.whatsAppInstance.findUnique({
      where: { id: body.whatsappInstanceId },
    });

    if (!instance) {
      return reply.badRequest('Instancia nao encontrada.');
    }

    const queueId = body.queueId ?? null;
    if (queueId) {
      const queue = await app.prisma.queue.findUnique({ where: { id: queueId } });
      if (!queue) {
        return reply.badRequest('Fila nao encontrada.');
      }
    }

    const remoteJid = normalizeRemoteJid(normalizedPhone);

    const existingTicket = await app.prisma.ticket.findFirst({
      where: {
        whatsappInstanceId: instance.id,
        externalChatId: remoteJid,
        status: { in: ['open', 'pending'] },
      },
      include: {
        currentAgent: true,
        currentQueue: true,
        whatsappInstance: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existingTicket) {
      return {
        item: serializeTicket(existingTicket),
        created: false,
      };
    }

    const customer = await app.prisma.customer.upsert({
      where: { phoneE164: normalizedPhone },
      update: {
        name: body.customerName,
      },
      create: {
        id: randomUUID(),
        name: body.customerName,
        phoneE164: normalizedPhone,
      },
    });

    const ticket = await app.prisma.ticket.create({
      data: {
        id: randomUUID(),
        customerId: customer.id,
        whatsappInstanceId: instance.id,
        currentAgentId: session.userId,
        currentQueueId: queueId,
        externalChatId: remoteJid,
        externalContactId: normalizedPhone,
        customerNameSnapshot: body.customerName,
        status: 'open',
        unreadCount: 0,
        isGroup: false,
      },
      include: {
        currentAgent: true,
        currentQueue: true,
        whatsappInstance: true,
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'created',
        actorUserId: session.userId,
        metadata: {
          source: 'manual',
          createdBy: session.userId,
        },
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: ticket.id,
      status: ticket.status,
      currentAgentId: ticket.currentAgentId,
      currentQueueId: ticket.currentQueueId,
    });

    return reply.code(201).send({
      item: serializeTicket(ticket),
      created: true,
    });
  });

  app.post('/tickets/:ticketId/accept', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.accept');
    if (!access) return;
    const session = access.session;

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
    const access = await requirePermission(app, request, reply, 'tickets.close');
    if (!access) return;
    const session = access.session;

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
