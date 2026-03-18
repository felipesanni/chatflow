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

const transferTicketBodySchema = z.object({
  agentId: z.string().uuid().optional().nullable(),
  queueId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().min(1).optional(),
}).refine((value) => value.agentId || value.queueId, {
  message: 'Informe um agente, uma fila ou ambos para transferir o ticket.',
});

function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

function normalizeRemoteJid(phone: string) {
  return `${phone}@s.whatsapp.net`;
}

async function findOrCreateCustomer(
  prisma: FastifyPluginAsync extends never ? never : any,
  params: { name: string; phoneE164: string },
) {
  const existing = await prisma.customer.findFirst({
    where: { phoneE164: params.phoneE164 },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    if (existing.name !== params.name) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: { name: params.name },
      });
    }

    return existing;
  }

  return prisma.customer.create({
    data: {
      id: randomUUID(),
      name: params.name,
      phoneE164: params.phoneE164,
    },
  });
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

    const customer = await findOrCreateCustomer(app.prisma, {
      name: body.customerName,
      phoneE164: normalizedPhone,
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

  app.post('/tickets/:ticketId/transfer', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.accept');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const body = transferTicketBodySchema.parse(request.body ?? {});

    const currentTicket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
        currentQueue: true,
        whatsappInstance: true,
      },
    });

    if (!currentTicket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (body.agentId) {
      const targetAgent = await app.prisma.agent.findUnique({
        where: { id: body.agentId },
        select: { id: true },
      });

      if (!targetAgent) {
        return reply.badRequest('Agente de destino nao encontrado.');
      }
    }

    if (body.queueId) {
      const targetQueue = await app.prisma.queue.findUnique({
        where: { id: body.queueId },
        select: { id: true },
      });

      if (!targetQueue) {
        return reply.badRequest('Fila de destino nao encontrada.');
      }
    }

    const reason = body.reason?.trim() || 'Transferencia manual';

    const ticket = await app.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        currentAgentId: body.agentId ?? null,
        currentQueueId: body.queueId ?? currentTicket.currentQueueId ?? null,
        status: body.agentId ? 'open' : 'pending',
      },
      include: {
        currentAgent: true,
        currentQueue: true,
        whatsappInstance: true,
      },
    });

    await app.prisma.ticketAssignment.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        fromAgentId: currentTicket.currentAgentId,
        toAgentId: body.agentId ?? null,
        fromQueueId: currentTicket.currentQueueId,
        toQueueId: body.queueId ?? currentTicket.currentQueueId ?? null,
        reason,
        createdByUserId: session.userId,
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'transferred',
        actorUserId: session.userId,
        metadata: {
          reason,
          fromAgentId: currentTicket.currentAgentId,
          toAgentId: body.agentId ?? null,
          fromQueueId: currentTicket.currentQueueId,
          toQueueId: body.queueId ?? currentTicket.currentQueueId ?? null,
        },
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: ticket.id,
      status: ticket.status,
      currentAgentId: ticket.currentAgentId,
      currentQueueId: ticket.currentQueueId,
    });

    return {
      item: serializeTicket(ticket),
    };
  });
};
