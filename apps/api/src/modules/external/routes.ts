import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireApiAccessToken } from '../../lib/api-token-auth.js';
import { deliverOutboundMessage } from '../../lib/outbound-messages.js';
import {
  buildActiveTicketIdentityWhere,
  buildTicketAliasCandidates,
  buildTicketChatIdentity,
  normalizeTicketRemoteJid,
  withTicketIdentityLock,
} from '../../lib/ticket-identity.js';

const externalEntityIdentifierSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      return Number(normalized);
    }
    return normalized;
  }

  return value;
}, z.union([z.number().int().positive(), z.string().uuid()]));

const optionalExternalEntityIdentifierSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (/^\d+$/.test(normalized)) {
      return Number(normalized);
    }
    return normalized;
  }

  return value;
}, z.union([z.number().int().positive(), z.string().uuid()]).optional().nullable());

const externalSendMessageBodySchema = z.object({
  phone: z.string().trim().min(8, 'Informe um telefone valido.'),
  body: z.string().trim().min(1, 'Informe a mensagem.'),
  whatsappInstanceId: externalEntityIdentifierSchema,
  queueId: optionalExternalEntityIdentifierSchema,
  agentId: optionalExternalEntityIdentifierSchema,
  customerName: z.string().trim().min(1).max(160).nullable().optional(),
});

const externalSendTicketMessageParamsSchema = z.object({
  ticketId: z.string().uuid(),
});

const externalSendTicketMessageBodySchema = z.object({
  body: z.string().trim().min(1, 'Informe a mensagem.'),
  replyToMessageId: z.string().uuid().optional().nullable(),
  internalNote: z.boolean().optional().default(false),
});

const externalListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const externalTicketListQuerySchema = externalListQuerySchema.extend({
  status: z.enum(['open', 'pending', 'closed']).optional(),
  phone: z.string().trim().min(8).optional(),
  queueId: optionalExternalEntityIdentifierSchema,
  agentId: optionalExternalEntityIdentifierSchema,
  whatsappInstanceId: optionalExternalEntityIdentifierSchema,
});

const externalCustomerListQuerySchema = externalListQuerySchema.extend({
  phone: z.string().trim().min(8).optional(),
});

const externalTransferTicketParamsSchema = z.object({
  ticketId: z.string().uuid(),
});

const externalTransferTicketBodySchema = z.object({
  agentId: optionalExternalEntityIdentifierSchema,
  queueId: optionalExternalEntityIdentifierSchema,
  note: z.string().trim().optional().default(''),
}).refine((value) => value.agentId || value.queueId, {
  message: 'Informe um agente, uma fila ou ambos para transferir o ticket.',
});

type ExternalTicketSnapshot = {
  id: string;
  status: 'open' | 'pending' | 'closed';
  customerNameSnapshot: string;
  customerAvatarUrl: string | null;
  externalChatId: string;
  externalContactId: string | null;
  isGroup: boolean;
  title: string | null;
  currentAgent: { id: string; name: string } | null;
  currentQueue: { id: string; name: string; color: string | null } | null;
  whatsappInstance: { id: string; name: string };
  updatedAt: Date;
};

type ExternalTicketResult = {
  created: boolean;
  ticket: ExternalTicketSnapshot;
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D+/g, '');

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

async function findOrCreateCustomer(
  tx: Prisma.TransactionClient,
  params: { name?: string | null; phoneE164: string },
) {
  const existing = await tx.customer.findFirst({
    where: { phoneE164: params.phoneE164 },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    if (params.name && existing.name !== params.name && !existing.isNameManuallySet) {
      return tx.customer.update({
        where: { id: existing.id },
        data: { name: params.name },
      });
    }

    return existing;
  }

  return tx.customer.create({
    data: {
      id: randomUUID(),
      name: params.name ?? params.phoneE164,
      phoneE164: params.phoneE164,
      isNameManuallySet: Boolean(params.name),
    },
  });
}

function serializeExternalTicket(ticket: {
  id: string;
  status: 'open' | 'pending' | 'closed';
  customerNameSnapshot: string;
  customerAvatarUrl: string | null;
  externalChatId: string;
  externalContactId: string | null;
  isGroup: boolean;
  title: string | null;
  currentAgent: { id: string; name: string } | null;
  currentQueue: { id: string; name: string; color: string | null } | null;
  whatsappInstance: { id: string; name: string };
  updatedAt: Date;
}) {
  const manualGroupName = ticket.isGroup && ticket.title?.trim() ? ticket.title.trim() : null;

  return {
    id: ticket.id,
    status: ticket.status,
    customerName: manualGroupName ?? ticket.customerNameSnapshot,
    customerAvatarUrl: ticket.customerAvatarUrl,
    externalChatId: ticket.externalChatId,
    externalContactId: ticket.externalContactId,
    currentAgent: ticket.currentAgent,
    currentQueue: ticket.currentQueue,
    whatsappInstance: ticket.whatsappInstance,
    updatedAt: ticket.updatedAt,
  };
}

function serializeExternalCustomer(customer: {
  id: string;
  name: string;
  phoneE164: string | null;
  avatarUrl: string | null;
  email: string | null;
  companyName: string | null;
  notes: string | null;
  updatedAt: Date;
}) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phoneE164,
    avatarUrl: customer.avatarUrl,
    email: customer.email,
    companyName: customer.companyName,
    notes: customer.notes,
    updatedAt: customer.updatedAt,
  };
}

function serializeExternalAgent(agent: {
  id: string;
  publicId: number;
  name: string;
  avatarUrl: string | null;
  presence: string;
  isBotAgent: boolean;
  user: { id: string; email: string; role: string } | null;
}) {
  return {
    id: agent.id,
    publicId: agent.publicId,
    name: agent.name,
    avatarUrl: agent.avatarUrl,
    presence: agent.presence,
    isBotAgent: agent.isBotAgent,
    user: agent.user
      ? {
          id: agent.user.id,
          email: agent.user.email,
          role: agent.user.role,
        }
      : null,
  };
}

function serializeExternalQueue(queue: {
  id: string;
  publicId: number;
  name: string;
  color: string | null;
  isActive: boolean;
  isBotQueue: boolean;
}) {
  return {
    id: queue.id,
    publicId: queue.publicId,
    name: queue.name,
    color: queue.color,
    isActive: queue.isActive,
    isBotQueue: queue.isBotQueue,
  };
}

export const externalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/external/tickets', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const query = externalTicketListQuerySchema.parse(request.query ?? {});
    const normalizedPhone = query.phone ? normalizePhone(query.phone) : undefined;
    const ticketAndFilters: Prisma.TicketWhereInput[] = [];

    if (normalizedPhone) {
      ticketAndFilters.push({
        OR: [
          { externalContactId: normalizedPhone },
          { externalChatId: normalizeTicketRemoteJid(normalizedPhone) },
        ],
      });
    }

    if (query.search) {
      ticketAndFilters.push({
        OR: [
          { customerNameSnapshot: { contains: query.search, mode: 'insensitive' } },
          { title: { contains: query.search, mode: 'insensitive' } },
          { externalChatId: { contains: query.search, mode: 'insensitive' } },
          { externalContactId: { contains: query.search, mode: 'insensitive' } },
          { lastMessagePreview: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const items = await app.prisma.ticket.findMany({
      where: {
        status: query.status,
        ...(query.queueId
          ? {
              currentQueue: typeof query.queueId === 'number'
                ? { publicId: query.queueId }
                : { id: query.queueId },
            }
          : {}),
        ...(query.agentId
          ? {
              currentAgent: typeof query.agentId === 'number'
                ? { publicId: query.agentId }
                : { id: query.agentId },
            }
          : {}),
        ...(query.whatsappInstanceId
          ? {
              whatsappInstance: typeof query.whatsappInstanceId === 'number'
                ? { publicId: query.whatsappInstanceId }
                : { id: query.whatsappInstanceId },
            }
          : {}),
        ...(ticketAndFilters.length > 0 ? { AND: ticketAndFilters } : {}),
      },
      include: {
        currentAgent: { select: { id: true, name: true } },
        currentQueue: { select: { id: true, name: true, color: true } },
        whatsappInstance: { select: { id: true, name: true } },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: query.limit,
    });

    return {
      items: items.map((item) => serializeExternalTicket(item)),
    };
  });

  app.get('/external/customers', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const query = externalCustomerListQuerySchema.parse(request.query ?? {});
    const normalizedPhone = query.phone ? normalizePhone(query.phone) : undefined;
    const customerAndFilters: Prisma.CustomerWhereInput[] = [];

    if (normalizedPhone) {
      customerAndFilters.push({
        phoneE164: normalizedPhone,
      });
    }

    if (query.search) {
      customerAndFilters.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { phoneE164: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { companyName: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const items = await app.prisma.customer.findMany({
      where: customerAndFilters.length > 0 ? { AND: customerAndFilters } : undefined,
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: query.limit,
    });

    return {
      items: items.map((item) => serializeExternalCustomer(item)),
    };
  });

  app.get('/external/users', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const query = externalListQuerySchema.parse(request.query ?? {});

    const items = await app.prisma.agent.findMany({
      where: query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [
        { isBotAgent: 'asc' },
        { name: 'asc' },
      ],
      take: query.limit,
    });

    return {
      items: items.map((item) => serializeExternalAgent(item)),
    };
  });

  app.get('/external/queues', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const query = externalListQuerySchema.parse(request.query ?? {});

    const items = await app.prisma.queue.findMany({
      where: query.search
        ? {
            name: { contains: query.search, mode: 'insensitive' },
          }
        : undefined,
      orderBy: [
        { isBotQueue: 'asc' },
        { name: 'asc' },
      ],
      take: query.limit,
    });

    return {
      items: items.map((item) => serializeExternalQueue(item)),
    };
  });

  app.post('/external/messages/send', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const body = externalSendMessageBodySchema.parse(request.body);
    const normalizedPhone = normalizePhone(body.phone);
    const remoteJid = normalizeTicketRemoteJid(normalizedPhone);
    const identity = buildTicketChatIdentity({
      remoteJid,
      phone: normalizedPhone,
      isGroup: false,
    });

    const instance = await app.prisma.whatsAppInstance.findUnique({
      where: typeof body.whatsappInstanceId === 'number'
        ? { publicId: body.whatsappInstanceId }
        : { id: body.whatsappInstanceId },
      select: {
        id: true,
        publicId: true,
        name: true,
      },
    });

    if (!instance) {
      return reply.notFound('Instancia nao encontrada.');
    }

    const queue = body.queueId
      ? await app.prisma.queue.findUnique({
          where: typeof body.queueId === 'number'
            ? { publicId: body.queueId }
            : { id: body.queueId },
          select: { id: true, publicId: true, name: true, color: true },
        })
      : null;

    if (body.queueId && !queue) {
      return reply.notFound('Fila nao encontrada.');
    }

    const agent = body.agentId
      ? await app.prisma.agent.findUnique({
          where: typeof body.agentId === 'number'
            ? { publicId: body.agentId }
            : { id: body.agentId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        })
      : null;

    if (body.agentId && !agent) {
      return reply.notFound('Agente nao encontrado.');
    }

    const fallbackActorUserId = accessToken.createdByUser?.id ?? agent?.user.id ?? null;
    const actorUserId = agent?.user.id ?? fallbackActorUserId;

    if (!actorUserId) {
      return reply.forbidden('O token nao possui um usuario responsavel para assinar a mensagem.');
    }

    const ticketResult = await withTicketIdentityLock(app.prisma, {
      whatsappInstanceId: instance.id,
      canonicalChatId: identity.canonicalChatId,
    }, async (tx): Promise<ExternalTicketResult> => {
      const existing = await tx.ticket.findFirst({
        where: buildActiveTicketIdentityWhere(instance.id, identity),
        include: {
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
      });

      if (existing) {
        return {
          created: false,
          ticket: existing,
        };
      }

      const customer = await findOrCreateCustomer(tx, {
        name: body.customerName ?? null,
        phoneE164: normalizedPhone,
      });

      const ticket = await tx.ticket.create({
        data: {
          id: randomUUID(),
          customerId: customer.id,
          customerNameSnapshot: customer.name,
          customerAvatarUrl: customer.avatarUrl,
          externalChatId: identity.canonicalChatId ?? remoteJid,
          externalContactId: normalizedPhone,
          isGroup: false,
          status: 'open',
          whatsappInstanceId: instance.id,
          currentQueueId: queue?.id ?? null,
          currentAgentId: agent?.id ?? null,
        },
        include: {
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
      });

      const aliasCandidates = buildTicketAliasCandidates({
        remoteJid,
        canonicalChatId: identity.canonicalChatId,
        contactId: normalizedPhone,
        aliases: identity.lookupChatIds,
      });

      if (aliasCandidates.length > 0) {
        await Promise.all(aliasCandidates.map((alias) => tx.ticketChatAlias.upsert({
          where: {
            whatsappInstanceId_alias: {
              whatsappInstanceId: instance.id,
              alias,
            },
          },
          create: {
            id: randomUUID(),
            whatsappInstanceId: instance.id,
            ticketId: ticket.id,
            alias,
          },
          update: {
            ticketId: ticket.id,
            lastSeenAt: new Date(),
          },
        })));
      }

      await tx.ticketEvent.create({
        data: {
          id: randomUUID(),
          ticketId: ticket.id,
          eventType: 'created',
          actorUserId,
          metadata: {
            source: 'external_api',
            tokenId: accessToken.id,
            tokenName: accessToken.name,
          },
        },
      });

      return {
        created: true,
        ticket,
      };
    });

    try {
      const delivered = await deliverOutboundMessage(app, {
        ticketId: ticketResult.ticket.id,
        actorUserId,
        body: body.body,
        suppressSignature: true,
      });

      return reply.code(201).send({
        created: ticketResult.created,
        item: serializeExternalTicket(ticketResult.ticket),
        message: {
          id: delivered.message.id,
          body: delivered.message.body,
          createdAt: delivered.message.createdAt,
        },
      });
    } catch (error) {
      if (ticketResult.created) {
        await app.prisma.ticket.delete({
          where: { id: ticketResult.ticket.id },
        }).catch(() => {});
      }

      app.log.error({
        action: 'external_message_send_failed',
        tokenId: accessToken.id,
        ticketId: ticketResult.ticket.id,
        error,
      }, 'Falha ao enviar mensagem via API externa.');

      return reply.code(502).send({
        code: 'external_delivery_failed',
        message: 'Nao foi possivel enviar a mensagem pela instância selecionada.',
      });
    }
  });

  app.post('/external/tickets/:ticketId/messages', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const params = externalSendTicketMessageParamsSchema.parse(request.params);
    const body = externalSendTicketMessageBodySchema.parse(request.body ?? {});

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: {
        id: true,
        currentAgentId: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    const actorUserId = accessToken.createdByUser?.id ?? ticket.currentAgentId ?? null;

    if (!actorUserId) {
      return reply.forbidden('O token nao possui um usuario responsavel para enviar mensagem neste ticket.');
    }

    try {
      const delivered = await deliverOutboundMessage(app, {
        ticketId: ticket.id,
        actorUserId,
        body: body.body,
        replyToMessageId: body.replyToMessageId ?? null,
        internalNote: body.internalNote,
        suppressSignature: true,
      });

      return reply.code(201).send({
        item: {
          id: delivered.message.id,
          ticketId: delivered.message.ticketId,
          body: delivered.message.body,
          createdAt: delivered.message.createdAt,
          externalMessageId: delivered.message.externalMessageId,
        },
      });
    } catch (error) {
      app.log.error({
        action: 'external_ticket_message_send_failed',
        tokenId: accessToken.id,
        ticketId: ticket.id,
        error,
      }, 'Falha ao enviar mensagem via API externa para ticket especifico.');

      return reply.code(502).send({
        code: 'external_delivery_failed',
        message: 'Nao foi possivel enviar a mensagem para o ticket informado.',
      });
    }
  });

  app.post('/external/tickets/:ticketId/transfer', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const params = externalTransferTicketParamsSchema.parse(request.params);
    const body = externalTransferTicketBodySchema.parse(request.body ?? {});

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: { select: { id: true, name: true } },
        currentQueue: { select: { id: true, name: true, color: true } },
        whatsappInstance: { select: { id: true, name: true } },
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    const targetAgent = body.agentId
      ? await app.prisma.agent.findUnique({
          where: typeof body.agentId === 'number'
            ? { publicId: body.agentId }
            : { id: body.agentId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        })
      : null;

    if (body.agentId && !targetAgent) {
      return reply.notFound('Agente nao encontrado.');
    }

    const targetQueue = body.queueId
      ? await app.prisma.queue.findUnique({
          where: typeof body.queueId === 'number'
            ? { publicId: body.queueId }
            : { id: body.queueId },
          select: { id: true, publicId: true, name: true, color: true },
        })
      : null;

    if (body.queueId && !targetQueue) {
      return reply.notFound('Fila nao encontrada.');
    }

    const actorUserId = accessToken.createdByUser?.id ?? targetAgent?.user?.id ?? null;
    if (!actorUserId) {
      return reply.forbidden('O token nao possui um usuario responsavel para registrar a transferencia.');
    }

    const reason = targetAgent
      ? 'Transferencia via API externa'
      : 'Transferencia via API externa para fila sem agente definido';

    const updated = await app.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        currentAgentId: targetAgent?.id ?? null,
        currentQueueId: targetQueue?.id ?? ticket.currentQueueId ?? null,
        status: targetAgent ? 'open' : 'pending',
      },
      include: {
        currentAgent: { select: { id: true, name: true } },
        currentQueue: { select: { id: true, name: true, color: true } },
        whatsappInstance: { select: { id: true, name: true } },
      },
    });

    await app.prisma.ticketAssignment.create({
      data: {
        id: randomUUID(),
        ticketId: updated.id,
        fromAgentId: ticket.currentAgentId,
        toAgentId: targetAgent?.id ?? null,
        fromQueueId: ticket.currentQueueId,
        toQueueId: targetQueue?.id ?? ticket.currentQueueId ?? null,
        reason,
        createdByUserId: actorUserId,
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: updated.id,
        eventType: 'transferred',
        actorUserId,
        metadata: {
          source: 'external_api',
          tokenId: accessToken.id,
          tokenName: accessToken.name,
          reason,
          fromAgentId: ticket.currentAgentId,
          toAgentId: targetAgent?.id ?? null,
          fromQueueId: ticket.currentQueueId,
          toQueueId: targetQueue?.id ?? ticket.currentQueueId ?? null,
          note: body.note.trim() || null,
        },
      },
    });

    if (body.note.trim()) {
      await app.prisma.ticketMessage.create({
        data: {
          id: randomUUID(),
          ticketId: updated.id,
          senderAgentId: targetAgent?.id ?? null,
          direction: 'outbound',
          contentType: 'text',
          body: body.note.trim(),
          senderNameSnapshot: targetAgent?.name ?? accessToken.name,
          rawPayload: {
            chatflowInternalNote: true,
            source: 'external_api_transfer',
          } as Prisma.InputJsonValue,
        },
      });
    }

    app.io.emit('ticket.updated', {
      ticketId: updated.id,
      status: updated.status,
      currentAgentId: updated.currentAgentId,
      currentQueueId: updated.currentQueueId,
    });

    return reply.code(200).send({
      item: serializeExternalTicket(updated),
    });
  });
};
