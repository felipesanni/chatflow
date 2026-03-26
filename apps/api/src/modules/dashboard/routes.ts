import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { Prisma, type TicketStatus } from '@prisma/client';
import { requirePermission } from '../../lib/auth-guard.js';
import type { PermissionMap } from '../../lib/permissions.js';

const dashboardQuerySchema = z.object({
  range: z.enum(['today', '7d', '30d']).optional().default('7d'),
  agentId: z.string().uuid().optional(),
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildRange(range: 'today' | '7d' | '30d') {
  const now = new Date();
  const end = now;
  const start = startOfDay(now);

  if (range === 'today') {
    return { key: range, label: 'Hoje', from: start, to: end };
  }

  const days = range === '7d' ? 7 : 30;
  const from = new Date(start);
  from.setDate(from.getDate() - (days - 1));
  return {
    key: range,
    label: range === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias',
    from,
    to: end,
  };
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function uniqueTicketsById<T extends { id: string }>(tickets: T[]) {
  return Array.from(new Map(tickets.map((ticket) => [ticket.id, ticket])).values());
}

function buildVisibilityFilters(
  permissions: PermissionMap,
  queueIds: string[],
  userId: string,
) {
  return [
    ...(permissions['tickets.groups']
      ? [{
          isGroup: true,
        }]
      : []),
    { currentAgentId: userId, isGroup: false },
    ...(queueIds.length > 0
      ? [{
          isGroup: false,
          ...(permissions['tickets.viewOthers']
            ? {}
            : { currentAgentId: null }),
          currentQueueId: { in: queueIds },
        }]
      : []),
    ...(permissions['tickets.viewUnassigned']
      ? [{
          isGroup: false,
          ...(permissions['tickets.viewOthers']
            ? {}
            : { currentAgentId: null }),
          currentQueueId: null,
        }]
      : []),
  ];
}

function buildVisibleTicketWhere(
  permissions: PermissionMap,
  queueIds: string[],
  userId: string,
) {
  if (permissions['tickets.viewAll']) {
    return {};
  }

  return {
    OR: buildVisibilityFilters(permissions, queueIds, userId),
  };
}

const dashboardScopedTicketConstraint: Prisma.TicketWhereInput = {
  OR: [
    { customerId: null },
    {
      customer: {
        is: {
          dashboardExcludedAt: null,
        },
      },
    },
  ],
};

const dashboardTicketSelect = {
  id: true,
  status: true,
  isGroup: true,
  customerNameSnapshot: true,
  title: true,
  unreadCount: true,
  createdAt: true,
  closedAt: true,
  updatedAt: true,
  currentAgent: { select: { id: true, name: true } },
  currentQueue: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TicketSelect;

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard/overview', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'dashboard.view');
    if (!access) return;

    const query = dashboardQuerySchema.parse(request.query);
    const range = buildRange(query.range);
    const visibleTicketWhere = buildVisibleTicketWhere(access.permissions, access.queueIds, access.session.userId);
    const selectedAgentId = query.agentId ?? null;

    if (selectedAgentId && selectedAgentId !== access.session.userId && !access.permissions['team.view']) {
      return reply.forbidden('Voce nao possui permissao para visualizar o dashboard de outros usuarios.');
    }

    const selectedAgentConstraint = selectedAgentId ? { currentAgentId: selectedAgentId } : {};

    const activeTickets = await app.prisma.ticket.findMany({
      where: {
        AND: [
          visibleTicketWhere,
          dashboardScopedTicketConstraint,
          selectedAgentConstraint,
          { status: { in: ['open', 'pending'] as TicketStatus[] } },
        ],
      },
      select: dashboardTicketSelect,
      orderBy: { updatedAt: 'desc' },
    });

    const periodTickets = await app.prisma.ticket.findMany({
      where: {
        AND: [
          visibleTicketWhere,
          dashboardScopedTicketConstraint,
          selectedAgentConstraint,
          {
            OR: [
              { createdAt: { gte: range.from, lte: range.to } },
              { closedAt: { gte: range.from, lte: range.to } },
            ],
          },
        ],
      },
      select: dashboardTicketSelect,
    });

    const createdTicketIds = periodTickets
      .filter((ticket) => !ticket.isGroup && ticket.createdAt >= range.from && ticket.createdAt <= range.to)
      .map((ticket) => ticket.id);

    const periodMessages = await app.prisma.ticketMessage.findMany({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        ticket: {
          AND: [
            visibleTicketWhere,
            dashboardScopedTicketConstraint,
            selectedAgentConstraint,
          ],
        },
      },
      select: {
        id: true,
        ticketId: true,
        direction: true,
        senderAgentId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const createdTicketMessages = createdTicketIds.length > 0
      ? await app.prisma.ticketMessage.findMany({
          where: {
            ticketId: { in: createdTicketIds },
          },
          select: {
            ticketId: true,
            direction: true,
            senderAgentId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const firstResponseMinutes: number[] = [];
    const acceptanceMinutes: number[] = [];
    const handleMinutes: number[] = [];

    const createdTicketMap = new Map(periodTickets.filter((ticket) => !ticket.isGroup).map((ticket) => [ticket.id, ticket]));
    const messagesByTicket = new Map<string, typeof createdTicketMessages>();

    for (const message of createdTicketMessages) {
      const current = messagesByTicket.get(message.ticketId) ?? [];
      current.push(message);
      messagesByTicket.set(message.ticketId, current);
    }

    for (const ticketId of createdTicketIds) {
      const ticket = createdTicketMap.get(ticketId);
      if (!ticket) continue;

      const ticketMessages = messagesByTicket.get(ticketId) ?? [];
      const firstOutbound = ticketMessages.find((message) => message.direction === 'outbound' && message.createdAt >= ticket.createdAt);

      if (firstOutbound) {
        const responseMinutes = minutesBetween(ticket.createdAt, firstOutbound.createdAt);
        firstResponseMinutes.push(responseMinutes);
        acceptanceMinutes.push(responseMinutes);
      }
    }

    for (const ticket of periodTickets) {
      if (!ticket.isGroup && ticket.closedAt) {
        handleMinutes.push(minutesBetween(ticket.createdAt, ticket.closedAt));
      }
    }

    const daySeriesMap = new Map<string, { date: string; created: number; closed: number; inbound: number; outbound: number }>();
    const cursor = new Date(range.from);
    while (cursor <= range.to) {
      const key = cursor.toISOString().slice(0, 10);
      daySeriesMap.set(key, { date: key, created: 0, closed: 0, inbound: 0, outbound: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const ticket of periodTickets) {
      const createdKey = ticket.createdAt.toISOString().slice(0, 10);
      if (daySeriesMap.has(createdKey)) {
        daySeriesMap.get(createdKey)!.created += 1;
      }

      if (ticket.closedAt) {
        const closedKey = ticket.closedAt.toISOString().slice(0, 10);
        if (daySeriesMap.has(closedKey)) {
          daySeriesMap.get(closedKey)!.closed += 1;
        }
      }
    }

    for (const message of periodMessages) {
      const key = message.createdAt.toISOString().slice(0, 10);
      if (!daySeriesMap.has(key)) continue;
      if (message.direction === 'inbound') {
        daySeriesMap.get(key)!.inbound += 1;
      }
      if (message.direction === 'outbound') {
        daySeriesMap.get(key)!.outbound += 1;
      }
    }

    const queueStats = new Map<string, { id: string; name: string; color: string | null; open: number; pending: number; closed: number }>();
    for (const ticket of uniqueTicketsById([...activeTickets, ...periodTickets])) {
      const queueId = ticket.currentQueue?.id ?? 'without-queue';
      const current = queueStats.get(queueId) ?? {
        id: queueId,
        name: ticket.currentQueue?.name ?? 'Sem fila',
        color: ticket.currentQueue?.color ?? null,
        open: 0,
        pending: 0,
        closed: 0,
      };

      if (ticket.status === 'open') current.open += 1;
      if (ticket.status === 'pending') current.pending += 1;
      if (ticket.closedAt && ticket.closedAt >= range.from && ticket.closedAt <= range.to) current.closed += 1;
      queueStats.set(queueId, current);
    }

    const agentStats = new Map<string, { id: string; name: string; open: number; pending: number; closed: number }>();
    for (const ticket of uniqueTicketsById([...activeTickets, ...periodTickets])) {
      const agentId = ticket.currentAgent?.id ?? 'without-agent';
      const current = agentStats.get(agentId) ?? {
        id: agentId,
        name: ticket.currentAgent?.name ?? 'Sem agente',
        open: 0,
        pending: 0,
        closed: 0,
      };

      if (ticket.status === 'open') current.open += 1;
      if (ticket.status === 'pending') current.pending += 1;
      if (ticket.closedAt && ticket.closedAt >= range.from && ticket.closedAt <= range.to) current.closed += 1;
      agentStats.set(agentId, current);
    }

    const pendingActiveTickets = activeTickets.filter((ticket) => ticket.status === 'pending');
    const pendingInboundMessages = pendingActiveTickets.length > 0
      ? await app.prisma.ticketMessage.findMany({
          where: {
            ticketId: { in: pendingActiveTickets.map((ticket) => ticket.id) },
            direction: 'inbound',
          },
          select: {
            ticketId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const lastInboundByTicket = new Map<string, Date>();
    for (const message of pendingInboundMessages) {
      if (!lastInboundByTicket.has(message.ticketId)) {
        lastInboundByTicket.set(message.ticketId, message.createdAt);
      }
    }

    const stalePending = pendingActiveTickets
      .map((ticket) => ({
        id: ticket.id,
        customerName: (ticket.isGroup && typeof ticket.title === 'string' && ticket.title.trim().length > 0) ? ticket.title.trim() : ticket.customerNameSnapshot,
        waitingMinutes: minutesBetween(lastInboundByTicket.get(ticket.id) ?? ticket.createdAt, new Date()),
        queueName: ticket.currentQueue?.name ?? 'Sem fila',
        agentName: ticket.currentAgent?.name ?? 'Sem agente',
      }))
      .sort((a, b) => b.waitingMinutes - a.waitingMinutes)
      .slice(0, 8);

    return {
      period: {
        key: range.key,
        label: range.label,
        from: range.from,
        to: range.to,
      },
      selectedAgentId,
      overview: {
        openTickets: activeTickets.filter((ticket) => ticket.status === 'open' && !ticket.isGroup).length,
        pendingTickets: activeTickets.filter((ticket) => ticket.status === 'pending' && !ticket.isGroup).length,
        groupTickets: activeTickets.filter((ticket) => ticket.isGroup).length,
        closedInPeriod: periodTickets.filter((ticket) => ticket.closedAt && ticket.closedAt >= range.from && ticket.closedAt <= range.to).length,
        unassignedTickets: activeTickets.filter((ticket) => !ticket.currentAgent).length,
        withoutQueueTickets: activeTickets.filter((ticket) => !ticket.currentQueue).length,
        inboundMessages: periodMessages.filter((message) => message.direction === 'inbound').length,
        outboundMessages: periodMessages.filter((message) => message.direction === 'outbound').length,
        averageFirstResponseMinutes: average(firstResponseMinutes),
        averageHandleMinutes: average(handleMinutes),
        averageAcceptanceMinutes: average(acceptanceMinutes),
      },
      queues: Array.from(queueStats.values()).sort((a, b) => (b.open + b.pending + b.closed) - (a.open + a.pending + a.closed)),
      agents: Array.from(agentStats.values()).sort((a, b) => (b.open + b.pending + b.closed) - (a.open + a.pending + a.closed)),
      dailySeries: Array.from(daySeriesMap.values()),
      alerts: {
        stalePending,
        withoutQueue: activeTickets.filter((ticket) => !ticket.currentQueue).slice(0, 8).map((ticket) => ({
          id: ticket.id,
          customerName: (ticket.isGroup && typeof ticket.title === 'string' && ticket.title.trim().length > 0) ? ticket.title.trim() : ticket.customerNameSnapshot,
          status: ticket.status,
        })),
        withoutAgent: activeTickets.filter((ticket) => !ticket.currentAgent && !ticket.isGroup).slice(0, 8).map((ticket) => ({
          id: ticket.id,
          customerName: ticket.customerNameSnapshot,
          status: ticket.status,
        })),
      },
    };
  });
};
