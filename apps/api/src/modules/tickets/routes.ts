import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { Prisma, type TicketStatus } from '@prisma/client';
import { requirePermission } from '../../lib/auth-guard.js';
import type { PermissionMap } from '../../lib/permissions.js';
import {
  ACTIVE_TICKET_STATUSES,
  buildActiveTicketIdentityWhere,
  buildTicketAliasCandidates,
  buildTicketChatIdentity,
  normalizeTicketRemoteJid,
  withTicketIdentityLock,
} from '../../lib/ticket-identity.js';

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

const duplicateTicketsQuerySchema = z.object({
  includeClosed: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().positive().max(1000).default(300),
});

const mergeDuplicateTicketsBodySchema = z.object({
  primaryTicketId: z.string().uuid(),
  duplicateTicketIds: z.array(z.string().uuid()).min(1, 'Informe ao menos um ticket duplicado.').max(50, 'Limite de 50 tickets por operacao.'),
}).superRefine((value, ctx) => {
  if (value.duplicateTicketIds.includes(value.primaryTicketId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['duplicateTicketIds'],
      message: 'O ticket principal nao pode estar na lista de duplicados.',
    });
  }
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
  const digits = value.replace(/\D+/g, '');

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function pickMergedStatus(statuses: TicketStatus[]) {
  if (statuses.includes('open')) {
    return 'open' as const;
  }

  if (statuses.includes('pending')) {
    return 'pending' as const;
  }

  return 'closed' as const;
}

function buildDuplicateDetectionKey(ticket: {
  whatsappInstanceId: string;
  externalChatId: string;
  externalContactId: string | null;
  isGroup: boolean;
}) {
  const identity = buildTicketChatIdentity({
    remoteJid: ticket.externalChatId,
    phone: ticket.externalContactId,
    isGroup: ticket.isGroup,
  });

  const canonical = identity.canonicalChatId ?? ticket.externalChatId;
  return `${ticket.whatsappInstanceId}:${ticket.isGroup ? 'group' : 'direct'}:${canonical}`;
}

function buildDuplicateGroupSummary(groupKey: string, items: Array<any>) {
  const sortedItems = [...items].sort((a, b) => {
    const statusPriority = (value: TicketStatus) => {
      if (value === 'open') return 0;
      if (value === 'pending') return 1;
      return 2;
    };

    const statusDiff = statusPriority(a.status) - statusPriority(b.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const primary = sortedItems[0];

  return {
    key: groupKey,
    primaryTicketId: primary.id,
    canonicalChatId: primary.externalContactId ?? primary.externalChatId,
    whatsappInstanceId: primary.whatsappInstanceId,
    whatsappInstanceName: primary.whatsappInstance.name,
    customerName: primary.customerNameSnapshot,
    isGroup: primary.isGroup,
    totalTickets: sortedItems.length,
    items: sortedItems.map((ticket) => ({
      id: ticket.id,
      status: ticket.status,
      externalChatId: ticket.externalChatId,
      externalContactId: ticket.externalContactId,
      customerName: ticket.customerNameSnapshot,
      currentAgentId: ticket.currentAgentId,
      currentQueueId: ticket.currentQueueId,
      unreadCount: ticket.unreadCount,
      updatedAt: ticket.updatedAt,
      createdAt: ticket.createdAt,
    })),
  };
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
  app.get('/tickets/duplicates', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.bulkDelete');
    if (!access) return;

    const query = duplicateTicketsQuerySchema.parse(request.query);
    const items = await app.prisma.ticket.findMany({
      where: query.includeClosed
        ? undefined
        : {
            status: { in: [...ACTIVE_TICKET_STATUSES] },
          },
      select: {
        id: true,
        whatsappInstanceId: true,
        externalChatId: true,
        externalContactId: true,
        customerNameSnapshot: true,
        status: true,
        unreadCount: true,
        isGroup: true,
        currentAgentId: true,
        currentQueueId: true,
        createdAt: true,
        updatedAt: true,
        whatsappInstance: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: query.limit,
    });

    const grouped = new Map<string, Array<(typeof items)[number]>>();
    for (const ticket of items) {
      const groupKey = buildDuplicateDetectionKey(ticket);
      const current = grouped.get(groupKey) ?? [];
      current.push(ticket);
      grouped.set(groupKey, current);
    }

    const duplicates = Array.from(grouped.entries())
      .filter(([, groupItems]) => groupItems.length > 1)
      .map(([groupKey, groupItems]) => buildDuplicateGroupSummary(groupKey, groupItems))
      .sort((a, b) => {
        const aUpdated = Math.max(...a.items.map((item) => new Date(item.updatedAt).getTime()));
        const bUpdated = Math.max(...b.items.map((item) => new Date(item.updatedAt).getTime()));
        return bUpdated - aUpdated;
      });

    return {
      items: duplicates,
      totalGroups: duplicates.length,
      scannedTickets: items.length,
    };
  });

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

    if (!normalizedPhone || !normalizedPhone.startsWith('55')) {
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

    const remoteJid = normalizeTicketRemoteJid(normalizedPhone);
    const chatIdentity = buildTicketChatIdentity({
      remoteJid,
      phone: normalizedPhone,
      isGroup: false,
    });
    const aliasCandidates = buildTicketAliasCandidates({
      remoteJid,
      canonicalChatId: chatIdentity.canonicalChatId ?? remoteJid,
      contactId: chatIdentity.contactId ?? normalizedPhone,
    });

    const result = await withTicketIdentityLock(app.prisma, {
      whatsappInstanceId: instance.id,
      canonicalChatId: chatIdentity.canonicalChatId ?? remoteJid,
    }, async (tx) => {
      const existingTicket = await tx.ticket.findFirst({
        where: buildActiveTicketIdentityWhere(instance.id, chatIdentity),
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
          item: existingTicket,
          created: false,
        };
      }

      const customer = await findOrCreateCustomer(tx, {
        name: body.customerName ?? null,
        phoneE164: normalizedPhone,
      });
      const customerName = body.customerName ?? customer.name ?? normalizedPhone;

      const ticket = await tx.ticket.create({
        data: {
          id: randomUUID(),
          customerId: customer.id,
          whatsappInstanceId: instance.id,
          currentAgentId: session.userId,
          currentQueueId: queueId,
          externalChatId: chatIdentity.canonicalChatId ?? remoteJid,
          externalContactId: chatIdentity.contactId ?? normalizedPhone,
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

      await tx.ticketEvent.create({
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

      return {
        item: ticket,
        created: true,
      };
    });

    for (const alias of aliasCandidates) {
      await app.prisma.ticketChatAlias.upsert({
        where: {
          whatsappInstanceId_alias: {
            whatsappInstanceId: instance.id,
            alias,
          },
        },
        create: {
          id: randomUUID(),
          whatsappInstanceId: instance.id,
          ticketId: result.item.id,
          alias,
          lastSeenAt: new Date(),
        },
        update: {
          ticketId: result.item.id,
          lastSeenAt: new Date(),
        },
      });
    }

    if (result.created) {
      app.io.emit('ticket.updated', {
        ticketId: result.item.id,
        status: result.item.status,
        currentAgentId: result.item.currentAgentId,
        currentQueueId: result.item.currentQueueId,
      });
    }

    return reply.code(result.created ? 201 : 200).send({
      item: serializeTicket(result.item),
      created: result.created,
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

  app.post('/tickets/merge-duplicates', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.bulkDelete');
    if (!access) return;
    const session = access.session;
    const body = mergeDuplicateTicketsBodySchema.parse(request.body ?? {});

    const tickets = await app.prisma.ticket.findMany({
      where: {
        id: {
          in: [body.primaryTicketId, ...body.duplicateTicketIds],
        },
      },
      include: {
        whatsappInstance: true,
      },
    });

    if (tickets.length !== body.duplicateTicketIds.length + 1) {
      return reply.badRequest('Um ou mais tickets informados nao foram encontrados.');
    }

    const primaryTicket = tickets.find((ticket) => ticket.id === body.primaryTicketId);
    if (!primaryTicket) {
      return reply.badRequest('Ticket principal nao encontrado.');
    }

    const duplicateTickets = tickets.filter((ticket) => body.duplicateTicketIds.includes(ticket.id));

    if (!canViewTicket(session.userId, access.permissions, access.queueIds, primaryTicket)) {
      return reply.forbidden('Voce nao possui permissao para mesclar o ticket principal.');
    }

    for (const ticket of duplicateTickets) {
      if (!canViewTicket(session.userId, access.permissions, access.queueIds, ticket)) {
        return reply.forbidden('Voce nao possui permissao para mesclar um ou mais tickets duplicados.');
      }
    }

    const inconsistentDuplicate = duplicateTickets.find((ticket) => (
      ticket.whatsappInstanceId !== primaryTicket.whatsappInstanceId
      || ticket.isGroup !== primaryTicket.isGroup
    ));

    if (inconsistentDuplicate) {
      return reply.badRequest('Todos os tickets devem pertencer a mesma instancia e ao mesmo tipo de conversa.');
    }

    const merged = await app.prisma.$transaction(async (tx) => {
      const currentPrimary = await tx.ticket.findUnique({
        where: { id: primaryTicket.id },
      });

      if (!currentPrimary) {
        throw new Error('Ticket principal nao encontrado durante a mesclagem.');
      }

      const currentDuplicates = await tx.ticket.findMany({
        where: {
          id: {
            in: duplicateTickets.map((ticket) => ticket.id),
          },
        },
      });

      const duplicateIds = currentDuplicates.map((ticket) => ticket.id);
      const primaryMessages = await tx.ticketMessage.findMany({
        where: {
          ticketId: currentPrimary.id,
        },
        select: {
          id: true,
          externalMessageId: true,
        },
      });
      const duplicateMessages = await tx.ticketMessage.findMany({
        where: {
          ticketId: { in: duplicateIds },
        },
        select: {
          id: true,
          ticketId: true,
          externalMessageId: true,
          createdAt: true,
        },
      });

      const primaryExternalIds = new Set(
        primaryMessages
          .map((message) => message.externalMessageId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      );

      const duplicateMessageIdsToDelete = duplicateMessages
        .filter((message) => message.externalMessageId && primaryExternalIds.has(message.externalMessageId))
        .map((message) => message.id);

      const duplicateMessageIdsToMove = duplicateMessages
        .filter((message) => !duplicateMessageIdsToDelete.includes(message.id))
        .map((message) => message.id);

      if (duplicateMessageIdsToMove.length > 0) {
        await tx.ticketMessage.updateMany({
          where: {
            id: { in: duplicateMessageIdsToMove },
          },
          data: {
            ticketId: currentPrimary.id,
          },
        });
      }

      if (duplicateMessageIdsToDelete.length > 0) {
        await tx.ticketMessage.deleteMany({
          where: {
            id: { in: duplicateMessageIdsToDelete },
          },
        });
      }

      await tx.ticketEvent.updateMany({
        where: {
          ticketId: { in: duplicateIds },
        },
        data: {
          ticketId: currentPrimary.id,
        },
      });

      await tx.ticketAssignment.updateMany({
        where: {
          ticketId: { in: duplicateIds },
        },
        data: {
          ticketId: currentPrimary.id,
        },
      });

      await tx.ticketChatAlias.updateMany({
        where: {
          ticketId: { in: duplicateIds },
        },
        data: {
          ticketId: currentPrimary.id,
          lastSeenAt: new Date(),
        },
      });

      const mergedStatuses = [currentPrimary.status, ...currentDuplicates.map((ticket) => ticket.status)];
      const latestPreviewOwner = [currentPrimary, ...currentDuplicates]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

      const updatedPrimary = await tx.ticket.update({
        where: { id: currentPrimary.id },
        data: {
          customerId: currentPrimary.customerId ?? currentDuplicates.find((ticket) => ticket.customerId)?.customerId ?? null,
          externalContactId: currentPrimary.externalContactId ?? currentDuplicates.find((ticket) => ticket.externalContactId)?.externalContactId ?? null,
          customerNameSnapshot: currentPrimary.customerNameSnapshot || currentDuplicates.find((ticket) => ticket.customerNameSnapshot)?.customerNameSnapshot || currentPrimary.externalChatId,
          customerAvatarUrl: currentPrimary.customerAvatarUrl ?? currentDuplicates.find((ticket) => ticket.customerAvatarUrl)?.customerAvatarUrl ?? null,
          currentAgentId: currentPrimary.currentAgentId ?? currentDuplicates.find((ticket) => ticket.currentAgentId)?.currentAgentId ?? null,
          currentQueueId: currentPrimary.currentQueueId ?? currentDuplicates.find((ticket) => ticket.currentQueueId)?.currentQueueId ?? null,
          status: pickMergedStatus(mergedStatuses),
          unreadCount: currentPrimary.unreadCount + currentDuplicates.reduce((sum, ticket) => sum + ticket.unreadCount, 0),
          lastMessagePreview: latestPreviewOwner.lastMessagePreview ?? currentPrimary.lastMessagePreview,
          updatedAt: new Date(),
        },
      });

      await tx.ticketEvent.create({
        data: {
          id: randomUUID(),
          ticketId: updatedPrimary.id,
          eventType: 'assigned',
          actorUserId: session.userId,
          metadata: {
            action: 'merged_duplicates',
            primaryTicketId: updatedPrimary.id,
            mergedTicketIds: duplicateIds,
            deletedDuplicateMessageIds: duplicateMessageIdsToDelete,
          },
        },
      });

      await tx.ticket.deleteMany({
        where: {
          id: { in: duplicateIds },
        },
      });

      return {
        primaryTicketId: updatedPrimary.id,
        mergedTicketIds: duplicateIds,
        movedMessageCount: duplicateMessageIdsToMove.length,
        deletedDuplicateMessageCount: duplicateMessageIdsToDelete.length,
      };
    });

    app.io.emit('ticket.updated', {
      ticketId: merged.primaryTicketId,
    });

    app.io.emit('ticket.updated', {
      bulkDeletedTicketIds: merged.mergedTicketIds,
    });

    return reply.code(201).send(merged);
  });
};
