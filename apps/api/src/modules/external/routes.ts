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
  conflict?: boolean;
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

export const externalRoutes: FastifyPluginAsync = async (app) => {
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
          conflict: true,
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

    if (ticketResult.conflict || !ticketResult.created) {
      return reply.code(409).send({
        code: 'ticket_open_exists',
        message: 'Ja existe um ticket aberto para este contato.',
        item: serializeExternalTicket(ticketResult.ticket),
      });
    }

    try {
      const delivered = await deliverOutboundMessage(app, {
        ticketId: ticketResult.ticket.id,
        actorUserId,
        body: body.body,
      });

      return reply.code(201).send({
        created: true,
        item: serializeExternalTicket(ticketResult.ticket),
        message: {
          id: delivered.message.id,
          body: delivered.message.body,
          createdAt: delivered.message.createdAt,
        },
      });
    } catch (error) {
      await app.prisma.ticket.delete({
        where: { id: ticketResult.ticket.id },
      }).catch(() => {});

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
};
