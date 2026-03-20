import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { Prisma, type TicketStatus } from '@prisma/client';
import { requirePermission } from '../../lib/auth-guard.js';
import type { PermissionMap } from '../../lib/permissions.js';

const ticketListQuerySchema = z.object({
  status: z.enum(['open', 'pending', 'closed']).optional(),
  agentId: z.string().uuid().optional(),
  queueId: z.string().uuid().optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const createTicketBodySchema = z.object({
  customerName: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(8, 'Informe um telefone valido.'),
  whatsappInstanceId: z.string().uuid('Selecione uma instancia valida.'),
  queueId: z.string().uuid().optional().nullable(),
});

const transferTicketBodySchema = z.object({
  agentId: z.string().uuid().optional().nullable(),
  queueId: z.string().uuid().optional().nullable(),
  note: z.string().trim().optional().default(''),
}).refine((value) => value.agentId || value.queueId, {
  message: 'Informe um agente, uma fila ou ambos para transferir o ticket.',
});

const bulkDeleteTicketsBodySchema = z.object({
  ticketIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um ticket.').max(100, 'Limite de 100 tickets por lote.'),
});

const closeTicketBodySchema = z.preprocess((value) => {
  if (value == null || value === '') {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return {};
    }
  }

  return value;
}, z.object({
  reason: z.string().trim().min(1).optional(),
}));

function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

function normalizeRemoteJid(phone: string) {
  return `${phone}@s.whatsapp.net`;
}

async function findOrCreateCustomer(
  prisma: FastifyPluginAsync extends never ? never : any,
  params: { name?: string | null; phoneE164: string },
) {
  const existing = await prisma.customer.findFirst({
    where: { phoneE164: params.phoneE164 },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    if (params.name && existing.name !== params.name) {
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
      name: params.name ?? params.phoneE164,
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
    externalContactId: ticket.externalContactId,
    customerAvatarUrl: ticket.customerAvatarUrl,
    lastMessagePreview: ticket.lastMessagePreview,
    unreadCount: ticket.unreadCount,
    currentAgent: ticket.currentAgent ? { id: ticket.currentAgent.id, name: ticket.currentAgent.name } : null,
    currentQueue: ticket.currentQueue ? { id: ticket.currentQueue.id, name: ticket.currentQueue.name } : null,
    whatsappInstance: { id: ticket.whatsappInstance.id, name: ticket.whatsappInstance.name },
    isGroup: ticket.isGroup,
    updatedAt: ticket.updatedAt,
  };
}

function canViewTicket(
  viewerId: string,
  permissions: PermissionMap,
  viewerQueueIds: string[],
  ticket: { currentAgentId: string | null; currentQueueId: string | null; status?: string | null },
) {
  if (ticket.status === 'closed' && !permissions['tickets.closedView']) {
    return false;
  }

  if (permissions['tickets.viewAll']) {
    return true;
  }

  if (ticket.currentAgentId === viewerId) {
    return true;
  }

  const canViewOtherUsers = permissions['tickets.viewOthers'];
  const isQueueScoped = ticket.currentQueueId ? viewerQueueIds.includes(ticket.currentQueueId) : false;

  if (ticket.currentQueueId) {
    if (!isQueueScoped) {
      return false;
    }

    return ticket.currentAgentId === null || canViewOtherUsers;
  }

  if (!permissions['tickets.viewUnassigned']) {
    return false;
  }

  return ticket.currentAgentId === null || canViewOtherUsers;
}

function canManageTicket(viewerId: string, ticket: { currentAgentId: string | null }) {
  return ticket.currentAgentId === viewerId;
}

export const ticketRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tickets', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

    const query = ticketListQuerySchema.parse(request.query);
    if (
      !access.permissions['tickets.viewAll']
      && !access.permissions['tickets.viewOthers']
      && query.agentId
      && query.agentId !== session.userId
    ) {
      return {
        items: [],
        filters: query,
        viewer: {
          id: session.userId,
          role: session.role,
        },
      };
    }

    const visibilityFilters = [
      { currentAgentId: session.userId },
      ...(access.queueIds.length > 0
        ? [{
            ...(access.permissions['tickets.viewOthers']
              ? {}
              : { currentAgentId: null }),
            currentQueueId: { in: access.queueIds },
          }]
        : []),
      ...(access.permissions['tickets.viewUnassigned']
        ? [{
            ...(access.permissions['tickets.viewOthers']
              ? {}
              : { currentAgentId: null }),
            currentQueueId: null,
          }]
        : []),
    ];

    const where = {
      status: query.status,
      currentAgentId: access.permissions['tickets.viewAll']
        ? query.agentId
        : access.permissions['tickets.viewOthers']
          ? query.agentId
          : query.agentId === session.userId
            ? query.agentId
            : undefined,
      currentQueueId: query.queueId,
      AND: [
        ...(!access.permissions['tickets.closedView']
          ? [{
              status: { in: ['open', 'pending'] as TicketStatus[] },
            }]
          : []),
        ...(!access.permissions['tickets.viewAll']
          ? [{
              OR: visibilityFilters,
            }]
          : []),
        ...(query.search
          ? [{
              OR: [
                { customerNameSnapshot: { contains: query.search, mode: 'insensitive' as const } },
                { externalChatId: { contains: query.search, mode: 'insensitive' as const } },
                { lastMessagePreview: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }]
          : []),
      ],
    };

    const items = await app.prisma.ticket.findMany({
      where,
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

    if (!canViewTicket(session.userId, access.permissions, access.queueIds, ticket)) {
      return reply.forbidden('Voce nao possui permissao para visualizar este ticket.');
    }

    return {
      item: {
        id: ticket.id,
        status: ticket.status,
        customerName: ticket.customerNameSnapshot,
        externalChatId: ticket.externalChatId,
        externalContactId: ticket.externalContactId,
        customerAvatarUrl: ticket.customerAvatarUrl,
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
      name: body.customerName ?? null,
      phoneE164: normalizedPhone,
    });
    const customerName = body.customerName ?? customer.name ?? normalizedPhone;

    const ticket = await app.prisma.ticket.create({
      data: {
        id: randomUUID(),
        customerId: customer.id,
        whatsappInstanceId: instance.id,
        currentAgentId: session.userId,
        currentQueueId: queueId,
        externalChatId: remoteJid,
        externalContactId: normalizedPhone,
        customerNameSnapshot: customerName,
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
    const currentTicket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
      },
    });

    if (!currentTicket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canViewTicket(session.userId, access.permissions, access.queueIds, currentTicket)) {
      return reply.forbidden('Voce nao possui permissao para assumir este ticket.');
    }

    if (currentTicket.currentAgentId && currentTicket.currentAgentId !== session.userId) {
      return reply.forbidden('Este ticket ja foi assumido por outro agente.');
    }

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
    const parsedBody = closeTicketBodySchema.parse(request.body);
    const reason = parsedBody.reason ?? 'Encerrado pelo agente';
    const currentTicket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: { id: true, currentAgentId: true },
    });

    if (!currentTicket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canManageTicket(session.userId, currentTicket)) {
      return reply.forbidden('Apenas o agente responsavel pode encerrar este ticket.');
    }

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

  app.post('/tickets/:ticketId/reopen', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.close');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const currentTicket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: { id: true, currentAgentId: true, status: true },
    });

    if (!currentTicket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (session.role !== 'admin' && !canManageTicket(session.userId, currentTicket)) {
      return reply.forbidden('Apenas o agente responsavel pode reabrir este ticket.');
    }

    const ticket = await app.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: 'open',
        closedReason: null,
        closedAt: null,
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'reopened',
        actorUserId: session.userId,
        metadata: Prisma.JsonNull,
      },
    });

    app.io.emit('ticket.updated', { ticketId: ticket.id });

    return {
      item: ticket,
    };
  });

  app.post('/tickets/:ticketId/transfer', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.transfer');
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

    if (!canManageTicket(session.userId, currentTicket)) {
      return reply.forbidden('Apenas o agente responsavel pode transferir este ticket.');
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

    const reason = body.agentId
      ? 'Transferencia manual'
      : 'Transferencia para fila sem agente definido';

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
            note: body.note.trim() || null,
          },
        },
      });

      if (body.note.trim()) {
        const internalNote = await app.prisma.ticketMessage.create({
          data: {
            id: randomUUID(),
            ticketId: ticket.id,
            senderAgentId: session.userId,
            direction: 'outbound',
            contentType: 'text',
            body: body.note.trim(),
            senderNameSnapshot: currentTicket.currentAgent?.name ?? session.email,
            rawPayload: {
              chatflowInternalNote: true,
              source: 'ticket_transfer',
            } as Prisma.InputJsonValue,
          },
        });

        app.io.emit('message.created', {
          ticketId: ticket.id,
          messageId: internalNote.id,
          direction: internalNote.direction,
        });
      }

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

  app.post('/tickets/bulk-delete', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.bulkDelete');
    if (!access) return;
    const session = access.session;
    const body = bulkDeleteTicketsBodySchema.parse(request.body ?? {});

    const tickets = await app.prisma.ticket.findMany({
      where: {
        id: { in: body.ticketIds },
      },
      select: {
        id: true,
        currentAgentId: true,
        currentQueueId: true,
      },
    });

    const allowedIds = tickets
      .filter((ticket) => canViewTicket(session.userId, access.permissions, access.queueIds, ticket))
      .map((ticket) => ticket.id);

    if (allowedIds.length === 0) {
      return reply.forbidden('Nenhum dos tickets selecionados pode ser apagado por este usuário.');
    }

    await app.prisma.ticket.deleteMany({
      where: {
        id: { in: allowedIds },
      },
    });

    app.io.emit('ticket.updated', {
      bulkDeletedTicketIds: allowedIds,
    });

    return reply.code(201).send({
      deletedCount: allowedIds.length,
      deletedTicketIds: allowedIds,
    });
  });

  app.post('/tickets/:ticketId/delete', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.bulkDelete');
    if (!access) return;
    const session = access.session;
    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: {
        id: true,
        currentAgentId: true,
        currentQueueId: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canViewTicket(session.userId, access.permissions, access.queueIds, ticket)) {
      return reply.forbidden('Voce nao possui permissao para apagar este ticket.');
    }

    await app.prisma.ticket.delete({
      where: { id: ticket.id },
    });

    app.io.emit('ticket.updated', {
      deletedTicketId: ticket.id,
    });

    return reply.code(201).send({
      deletedTicketId: ticket.id,
    });
  });
};
