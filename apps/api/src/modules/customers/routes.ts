import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { requirePermission } from '../../lib/auth-guard.js';
import {
  decodeTimestampCursor,
  encodeTimestampCursor,
} from '../../lib/timestamp-cursor.js';

const customerListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).default(300),
});

const customerLookupQuerySchema = z.object({
  phone: z.string().trim().min(8).max(80),
});

export const customerRoutes: FastifyPluginAsync = async (app) => {
  const customerBodySchema = z.object({
    name: z.string().trim().min(1, 'Informe o nome do contato.'),
    phone: z.string().trim().optional().nullable(),
    email: z.string().trim().email('Informe um e-mail valido.').optional().or(z.literal('')).nullable(),
    companyName: z.string().trim().optional().or(z.literal('')).nullable(),
    notes: z.string().trim().optional().or(z.literal('')).nullable(),
    dashboardExcluded: z.boolean().optional().default(false),
  });
  const customerDashboardVisibilitySchema = z.object({
    ignored: z.boolean(),
  });

  function normalizePhone(value: string | null | undefined) {
    if (!value) return null;
    const digits = value.replace(/\D+/g, '');
    return digits || null;
  }

  function phoneLookupCandidates(value: string | null | undefined) {
    const normalized = normalizePhone(value);
    if (!normalized) return [];

    const candidates = new Set([normalized]);
    if (normalized.startsWith('55') && normalized.length > 11) {
      candidates.add(normalized.slice(2));
    } else if ((normalized.length === 10 || normalized.length === 11) && !normalized.startsWith('55')) {
      candidates.add(`55${normalized}`);
    }

    return Array.from(candidates);
  }

  function canViewCustomerTicket(
    viewerId: string,
    permissions: Record<string, boolean>,
    viewerQueueIds: string[],
    ticket: { currentAgentId: string | null; currentQueueId: string | null; status: string; isGroup: boolean },
    allowRelatedHistory = false,
  ) {
    if (ticket.status === 'closed' && !permissions['tickets.closedView'] && !allowRelatedHistory) {
      return false;
    }

    if (ticket.isGroup) {
      return permissions['tickets.groups'];
    }

    if (ticket.status === 'closed' && (permissions['tickets.closedView'] || allowRelatedHistory)) {
      return true;
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

  function serializeCustomerTicket(ticket: {
    id: string;
    status: 'open' | 'pending' | 'closed';
    customerId: string | null;
    customerNameSnapshot: string;
    title: string | null;
    externalChatId: string;
    externalContactId: string | null;
    customerAvatarUrl: string | null;
    lastMessagePreview: string | null;
    unreadCount: number;
    isGroup: boolean;
    updatedAt: Date;
    currentAgent: { id: string; name: string } | null;
    currentQueue: { id: string; name: string; color: string | null } | null;
    whatsappInstance: { id: string; name: string };
  }) {
    const manualGroupName = ticket.isGroup && typeof ticket.title === 'string' && ticket.title.trim().length > 0
      ? ticket.title.trim()
      : null;
    const displayName = manualGroupName ?? ticket.customerNameSnapshot;

    return {
      id: ticket.id,
      status: ticket.status,
      customerId: ticket.customerId,
      customerName: displayName,
      manualGroupName,
      externalChatId: ticket.externalChatId,
      externalContactId: ticket.externalContactId,
      customerAvatarUrl: ticket.customerAvatarUrl,
      lastMessagePreview: ticket.lastMessagePreview,
      unreadCount: ticket.unreadCount,
      currentAgent: ticket.currentAgent ? { id: ticket.currentAgent.id, name: ticket.currentAgent.name } : null,
      currentQueue: ticket.currentQueue ? { id: ticket.currentQueue.id, name: ticket.currentQueue.name, color: ticket.currentQueue.color } : null,
      whatsappInstance: { id: ticket.whatsappInstance.id, name: ticket.whatsappInstance.name },
      isGroup: ticket.isGroup,
      updatedAt: ticket.updatedAt,
    };
  }

  app.get('/customers', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.view');
    if (!access) return;

    const query = customerListQuerySchema.parse(request.query ?? {});
    const cursor = query.cursor ? decodeTimestampCursor(query.cursor) : null;

    if (query.cursor && !cursor) {
      return reply.badRequest('Cursor de contatos invalido.');
    }

    const search = query.search?.trim() || null;
    const phoneSearch = search ? search.replace(/\D+/g, '') : '';
    const filters: Prisma.CustomerWhereInput[] = [];

    if (cursor) {
      filters.push({
        OR: [
          { updatedAt: { lt: cursor.timestamp } },
          { updatedAt: cursor.timestamp, id: { lt: cursor.id } },
        ],
      });
    }

    if (search) {
      filters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          ...(phoneSearch ? [{ phoneE164: { contains: phoneSearch } }] : []),
        ],
      });
    }

    const items = await app.prisma.customer.findMany({
      where: filters.length > 0 ? { AND: filters } : undefined,
      select: {
        id: true,
        name: true,
        phoneE164: true,
        avatarUrl: true,
        email: true,
        companyName: true,
        notes: true,
        isNameManuallySet: true,
        dashboardExcludedAt: true,
        createdAt: true,
        updatedAt: true,
        tickets: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
            currentQueue: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      take: query.limit + 1,
    });

    const hasMore = items.length > query.limit;
    const pageItems = items.slice(0, query.limit);
    const oldestItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && oldestItem
      ? encodeTimestampCursor({
          id: oldestItem.id,
          timestamp: oldestItem.updatedAt,
        })
      : null;

    return {
      items: pageItems.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        isNameManuallySet: customer.isNameManuallySet,
        dashboardExcluded: Boolean(customer.dashboardExcludedAt),
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastTicket: customer.tickets[0]
          ? {
              id: customer.tickets[0].id,
              status: customer.tickets[0].status,
              updatedAt: customer.tickets[0].updatedAt,
              queueName: customer.tickets[0].currentQueue?.name ?? null,
            }
              : null,
      })),
      pagination: {
        limit: query.limit,
        hasMore,
        nextCursor,
      },
    };
  });

  app.get('/customers/lookup', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.view');
    if (!access) return;

    const query = customerLookupQuerySchema.parse(request.query ?? {});
    const phoneCandidates = phoneLookupCandidates(query.phone);
    const customer = phoneCandidates.length > 0
      ? await app.prisma.customer.findFirst({
          where: { phoneE164: { in: phoneCandidates } },
          select: {
            id: true,
            name: true,
            phoneE164: true,
            avatarUrl: true,
            email: true,
            companyName: true,
            notes: true,
            dashboardExcludedAt: true,
            createdAt: true,
            updatedAt: true,
            tickets: {
              select: {
                id: true,
                status: true,
                updatedAt: true,
                currentQueue: {
                  select: {
                    name: true,
                  },
                },
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: 1,
            },
          },
        })
      : null;

    return {
      item: customer
        ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phoneE164,
            avatarUrl: customer.avatarUrl,
            email: customer.email,
            companyName: customer.companyName,
            notes: customer.notes,
            dashboardExcluded: Boolean(customer.dashboardExcludedAt),
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
            lastTicket: customer.tickets[0]
              ? {
                  id: customer.tickets[0].id,
                  status: customer.tickets[0].status,
                  updatedAt: customer.tickets[0].updatedAt,
                  queueName: customer.tickets[0].currentQueue?.name ?? null,
                }
              : null,
          }
        : null,
    };
  });

  app.get('/customers/:customerId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.view');
    if (!access) return;

    const params = z.object({ customerId: z.string().uuid() }).parse(request.params);
    const customer = await app.prisma.customer.findUnique({
      where: { id: params.customerId },
      select: {
        id: true,
        name: true,
        phoneE164: true,
        avatarUrl: true,
        email: true,
        companyName: true,
        notes: true,
        dashboardExcludedAt: true,
        createdAt: true,
        updatedAt: true,
        tickets: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
            currentQueue: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!customer) {
      return reply.notFound('Contato nao encontrado.');
    }

    return {
      item: {
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        dashboardExcluded: Boolean(customer.dashboardExcludedAt),
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastTicket: customer.tickets[0]
          ? {
              id: customer.tickets[0].id,
              status: customer.tickets[0].status,
              updatedAt: customer.tickets[0].updatedAt,
              queueName: customer.tickets[0].currentQueue?.name ?? null,
            }
          : null,
      },
    };
  });

  app.get('/customers/:customerId/tickets', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.view');
    if (!access) return;

    const params = z.object({ customerId: z.string().uuid() }).parse(request.params);

    const customer = await app.prisma.customer.findUnique({
      where: { id: params.customerId },
      select: {
        id: true,
        name: true,
        phoneE164: true,
      },
    });

    if (!customer) {
      return reply.notFound('Contato nao encontrado.');
    }

    const ticketIdentityCandidates = Array.from(new Set(
      phoneLookupCandidates(customer.phoneE164).flatMap((phone) => [
        phone,
        `${phone}@s.whatsapp.net`,
        `${phone}@c.us`,
      ]),
    ));

    const tickets = await app.prisma.ticket.findMany({
      where: {
        OR: [
          { customerId: params.customerId },
          ...(ticketIdentityCandidates.length > 0
            ? [{
                customerId: null,
                isGroup: false,
                OR: [
                  { externalContactId: { in: ticketIdentityCandidates } },
                  { externalChatId: { in: ticketIdentityCandidates } },
                ],
              }]
            : []),
        ],
      },
      select: {
        id: true,
        status: true,
        customerId: true,
        customerNameSnapshot: true,
        title: true,
        externalChatId: true,
        externalContactId: true,
        customerAvatarUrl: true,
        lastMessagePreview: true,
        unreadCount: true,
        isGroup: true,
        updatedAt: true,
        currentAgentId: true,
        currentQueueId: true,
        currentAgent: {
          select: {
            id: true,
            name: true,
          },
        },
        currentQueue: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const customerTickets = tickets.map((ticket) => ticket.customerId
      ? ticket
      : {
          ...ticket,
          customerId: customer.id,
          customerNameSnapshot: customer.name,
        });

    const visibleTickets = customerTickets
      .filter((ticket) =>
        canViewCustomerTicket(access.session.userId, access.permissions, access.queueIds, {
          currentAgentId: ticket.currentAgentId,
          currentQueueId: ticket.currentQueueId,
          status: ticket.status,
          isGroup: ticket.isGroup,
        }, access.permissions['tickets.relatedHistory']))
      .map(serializeCustomerTicket);

    return reply.send({
      item: {
        id: customer.id,
        name: customer.name,
      },
      tickets: visibleTickets,
    });
  });

  app.post('/customers', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.manage');
    if (!access) return;

    const body = customerBodySchema.parse(request.body ?? {});
    const phone = normalizePhone(body.phone);
    const email = body.email?.trim() || null;

    if (phone) {
      const phoneConflict = await app.prisma.customer.findFirst({
        where: { phoneE164: phone },
        select: { id: true },
      });

      if (phoneConflict) {
        return reply.conflict('Ja existe um contato com este telefone.');
      }
    }

    if (email) {
      const emailConflict = await app.prisma.customer.findFirst({
        where: { email },
        select: { id: true },
      });

      if (emailConflict) {
        return reply.conflict('Ja existe um contato com este e-mail.');
      }
    }

    const customer = await app.prisma.customer.create({
      data: {
        id: randomUUID(),
        name: body.name.trim(),
        phoneE164: phone,
        avatarUrl: null,
        email,
        companyName: body.companyName?.trim() || null,
        notes: body.notes?.trim() || null,
        isNameManuallySet: true,
        dashboardExcludedAt: body.dashboardExcluded ? new Date() : null,
        dashboardExcludedByUserId: body.dashboardExcluded ? access.session.userId : null,
      },
    });

    return reply.code(201).send({
      item: {
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        isNameManuallySet: customer.isNameManuallySet,
        dashboardExcluded: Boolean(customer.dashboardExcludedAt),
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastTicket: null,
      },
    });
  });

  app.put('/customers/:customerId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.manage');
    if (!access) return;

    const params = z.object({ customerId: z.string().uuid() }).parse(request.params);
    const body = customerBodySchema.parse(request.body ?? {});
    const phone = normalizePhone(body.phone);
    const email = body.email?.trim() || null;

    const existing = await app.prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { id: true, phoneE164: true },
    });

    if (!existing) {
      return reply.notFound('Contato nao encontrado.');
    }

    if (phone) {
      const phoneConflict = await app.prisma.customer.findFirst({
        where: {
          phoneE164: phone,
          id: { not: params.customerId },
        },
        select: { id: true },
      });

      if (phoneConflict) {
        return reply.conflict('Ja existe outro contato com este telefone.');
      }
    }

    if (email) {
      const emailConflict = await app.prisma.customer.findFirst({
        where: {
          email,
          id: { not: params.customerId },
        },
        select: { id: true },
      });

      if (emailConflict) {
        return reply.conflict('Ja existe outro contato com este e-mail.');
      }
    }

    const customer = await app.prisma.customer.update({
      where: { id: params.customerId },
      data: {
        name: body.name.trim(),
        phoneE164: phone,
        email,
        companyName: body.companyName?.trim() || null,
        notes: body.notes?.trim() || null,
        isNameManuallySet: true,
        dashboardExcludedAt: body.dashboardExcluded ? new Date() : null,
        dashboardExcludedByUserId: body.dashboardExcluded ? access.session.userId : null,
      },
    });

    const ticketIdentityCandidates = Array.from(new Set([
      customer.phoneE164,
      existing.phoneE164,
      customer.phoneE164 ? `${customer.phoneE164}@s.whatsapp.net` : null,
      customer.phoneE164 ? `${customer.phoneE164}@c.us` : null,
      existing.phoneE164 ? `${existing.phoneE164}@s.whatsapp.net` : null,
      existing.phoneE164 ? `${existing.phoneE164}@c.us` : null,
    ].filter((value): value is string => Boolean(value))));

    await app.prisma.ticket.updateMany({
      where: {
        OR: [
          { customerId: customer.id },
          {
            isGroup: false,
            OR: [
              { externalContactId: { in: ticketIdentityCandidates } },
              { externalChatId: { in: ticketIdentityCandidates } },
            ],
          },
        ],
      },
      data: {
        customerId: customer.id,
        customerNameSnapshot: customer.name,
      },
    });

    return reply.send({
      item: {
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        isNameManuallySet: customer.isNameManuallySet,
        dashboardExcluded: Boolean(customer.dashboardExcludedAt),
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
    });
  });

  app.patch('/customers/:customerId/dashboard-visibility', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.manage');
    if (!access) return;

    const params = z.object({ customerId: z.string().uuid() }).parse(request.params);
    const body = customerDashboardVisibilitySchema.parse(request.body ?? {});

    const existing = await app.prisma.customer.findUnique({
      where: { id: params.customerId },
    });

    if (!existing) {
      return reply.notFound('Contato nao encontrado.');
    }

    const customer = await app.prisma.customer.update({
      where: { id: params.customerId },
      data: {
        dashboardExcludedAt: body.ignored ? new Date() : null,
        dashboardExcludedByUserId: body.ignored ? access.session.userId : null,
      },
    });

    return reply.send({
      item: {
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        isNameManuallySet: customer.isNameManuallySet,
        dashboardExcluded: Boolean(customer.dashboardExcludedAt),
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastTicket: null,
      },
    });
  });

  app.delete('/customers/:customerId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.manage');
    if (!access) return;
    void access;

    const params = z.object({ customerId: z.string().uuid() }).parse(request.params);

    const existing = await app.prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Contato nao encontrado.');
    }

    await app.prisma.customer.delete({
      where: { id: params.customerId },
    });

    return reply.send({
      message: 'Contato excluido.',
    });
  });
};
