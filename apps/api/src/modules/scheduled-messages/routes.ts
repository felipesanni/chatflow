import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { requirePermission } from '../../lib/auth-guard.js';

const outgoingAttachmentSchema = z.object({
  kind: z.enum(['image', 'audio', 'document']),
  fileName: z.string().trim().min(1, 'Informe o nome do arquivo.'),
  mimeType: z.string().trim().min(1, 'Informe o tipo do arquivo.'),
  dataUrl: z.string().trim().min(1, 'Informe o conteudo do arquivo.'),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const createScheduledMessageBodySchema = z.object({
  body: z.string().trim().optional().default(''),
  replyToMessageId: z.string().uuid().optional(),
  attachment: outgoingAttachmentSchema.optional(),
  internalNote: z.boolean().optional().default(false),
  sendAt: z.string().min(1, 'Informe quando a mensagem deve ser enviada.'),
}).superRefine((value, ctx) => {
  if (!value.body.trim() && !value.attachment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe uma mensagem ou anexe um arquivo para agendar.',
      path: ['body'],
    });
  }

  if (value.internalNote && value.attachment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Observacoes internas nao aceitam anexos.',
      path: ['attachment'],
    });
  }
});

const updateScheduledMessageBodySchema = z.object({
  body: z.string().trim().optional(),
  sendAt: z.string().min(1, 'Informe quando a mensagem deve ser enviada.').optional(),
});

function mapScheduledMessage(item: {
  id: string;
  ticketId: string;
  body: string | null;
  contentType: unknown;
  internalNote: boolean;
  attachmentPayload: unknown;
  replyToMessageId: string | null;
  sendAt: Date;
  status: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  createdByUser: {
    id: string;
    email: string;
    agent: { name: string } | null;
  };
  ticket?: {
    id: string;
    status: string;
    customerNameSnapshot: string;
    title: string | null;
    isGroup: boolean;
    currentQueue: { id: string; name: string; color: string | null } | null;
    currentAgent: { id: string; name: string } | null;
    whatsappInstance: { id: string; name: string };
  };
}) {
  return {
    id: item.id,
    ticketId: item.ticketId,
    body: item.body,
    contentType: item.contentType,
    internalNote: item.internalNote,
    attachment: item.attachmentPayload,
    replyToMessageId: item.replyToMessageId,
    sendAt: item.sendAt,
    status: item.status,
    errorMessage: item.errorMessage,
    sentAt: item.sentAt,
    createdAt: item.createdAt,
    createdBy: {
      id: item.createdByUser.id,
      name: item.createdByUser.agent?.name ?? item.createdByUser.email,
    },
    ticket: item.ticket
      ? {
          id: item.ticket.id,
          status: item.ticket.status,
          customerName: item.ticket.title?.trim() || item.ticket.customerNameSnapshot,
          manualGroupName: item.ticket.title,
          isGroup: item.ticket.isGroup,
          currentQueue: item.ticket.currentQueue,
          currentAgent: item.ticket.currentAgent,
          whatsappInstance: item.ticket.whatsappInstance,
        }
      : undefined,
  };
}

function canReplyToTicket(
  viewerId: string,
  permissions: Record<string, boolean>,
  viewerQueueIds: string[],
  ticket: { currentAgentId: string | null; currentQueueId?: string | null; status?: string | null; isGroup?: boolean | null },
) {
  if (ticket.isGroup) {
    return permissions['tickets.groups'];
  }

  if (ticket.status === 'closed') {
    return permissions['tickets.reopen'];
  }

  if (ticket.currentAgentId && ticket.currentAgentId !== viewerId) {
    return permissions['tickets.viewOthers'];
  }

  if (ticket.currentQueueId && viewerQueueIds.length > 0 && !viewerQueueIds.includes(ticket.currentQueueId)) {
    return permissions['tickets.transfer'];
  }

  return true;
}

function canViewTicket(
  viewerId: string,
  permissions: Record<string, boolean>,
  viewerQueueIds: string[],
  ticket: { currentAgentId: string | null; currentQueueId?: string | null; status?: string | null; isGroup?: boolean | null },
) {
  if (ticket.isGroup) {
    return permissions['tickets.groups'];
  }

  if (ticket.currentAgentId && ticket.currentAgentId !== viewerId && !permissions['tickets.viewOthers']) {
    return false;
  }

  if (ticket.currentQueueId && viewerQueueIds.length > 0 && !viewerQueueIds.includes(ticket.currentQueueId) && !permissions['tickets.transfer']) {
    return false;
  }

  return true;
}

export const scheduledMessageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/scheduled-messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'calendar.view');
    if (!access) return;
    const session = access.session;

    const query = z.object({
      status: z.string().trim().optional(),
    }).parse(request.query ?? {});

    const requestedStatuses = (query.status ?? 'pending,processing,failed')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as Array<'pending' | 'processing' | 'sent' | 'failed' | 'canceled'>;

    const items = await app.prisma.scheduledMessage.findMany({
      where: requestedStatuses.length > 0
        ? {
            status: {
              in: requestedStatuses,
            },
          }
        : undefined,
      orderBy: [
        { sendAt: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
            agent: {
              select: {
                name: true,
              },
            },
          },
        },
        ticket: {
          include: {
            currentQueue: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            currentAgent: {
              select: {
                id: true,
                name: true,
              },
            },
            whatsappInstance: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      items: items
        .filter((item) => canViewTicket(session.userId, access.permissions, access.queueIds, item.ticket))
        .map((item) => mapScheduledMessage(item)),
    };
  });

  app.get('/tickets/:ticketId/scheduled-messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canViewTicket(session.userId, access.permissions, access.queueIds, ticket)) {
      return reply.forbidden('Voce nao pode visualizar este ticket.');
    }

    const items = await app.prisma.scheduledMessage.findMany({
      where: {
        ticketId: params.ticketId,
        status: {
          in: ['pending', 'processing', 'failed'],
        },
      },
      orderBy: {
        sendAt: 'asc',
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
            agent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      items: items.map((item) => mapScheduledMessage(item)),
    };
  });

  app.post('/tickets/:ticketId/scheduled-messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const body = createScheduledMessageBodySchema.parse(request.body);
    const sendAt = new Date(body.sendAt);

    if (Number.isNaN(sendAt.getTime())) {
      return reply.badRequest('Data de agendamento invalida.');
    }

    if (sendAt.getTime() <= Date.now() + 5_000) {
      return reply.badRequest('Escolha um horario pelo menos 5 segundos no futuro.');
    }

    if (!app.jobs.enabled) {
      return reply.badRequest('O agendamento nao esta disponivel porque a fila de jobs nao esta configurada.');
    }

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (ticket.status === 'closed') {
      return reply.badRequest('Nao e possivel agendar mensagem para ticket fechado.');
    }

    if (!canReplyToTicket(session.userId, access.permissions, access.queueIds, ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode agendar mensagens neste ticket.');
    }

    const item = await app.prisma.scheduledMessage.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        createdByUserId: session.userId,
        body: body.body.trim() || null,
        contentType: body.attachment?.kind ?? 'text',
        attachmentPayload: body.attachment ? body.attachment as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
        internalNote: body.internalNote,
        replyToMessageId: body.replyToMessageId ?? null,
        sendAt,
        status: 'pending',
      },
    });

    await app.jobs.enqueueScheduledMessage(
      { scheduledMessageId: item.id },
      {
        delayMs: Math.max(0, sendAt.getTime() - Date.now()),
        jobId: `scheduled-message-${item.id}`,
      },
    );

    app.io.emit('ticket.updated', {
      ticketId: ticket.id,
      scheduledMessageId: item.id,
    });

    return reply.code(201).send({ item });
  });

  app.patch('/scheduled-messages/:scheduledMessageId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      scheduledMessageId: z.string().uuid(),
    }).parse(request.params);
    const body = updateScheduledMessageBodySchema.parse(request.body);

    const scheduled = await app.prisma.scheduledMessage.findUnique({
      where: {
        id: params.scheduledMessageId,
      },
      include: {
        ticket: {
          include: {
            currentAgent: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            email: true,
            agent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!scheduled) {
      return reply.notFound('Mensagem agendada nao encontrada.');
    }

    if (!canReplyToTicket(session.userId, access.permissions, access.queueIds, scheduled.ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode editar mensagens agendadas neste ticket.');
    }

    if (scheduled.status === 'sent' || scheduled.status === 'canceled') {
      return reply.badRequest('A mensagem agendada nao pode mais ser editada.');
    }

    const nextSendAt = body.sendAt ? new Date(body.sendAt) : scheduled.sendAt;
    if (Number.isNaN(nextSendAt.getTime())) {
      return reply.badRequest('Data de agendamento invalida.');
    }

    if (nextSendAt.getTime() <= Date.now() + 5_000) {
      return reply.badRequest('Escolha um horario pelo menos 5 segundos no futuro.');
    }

    const nextBody = body.body !== undefined ? body.body.trim() : (scheduled.body ?? '');
    const hasAttachment = Boolean(scheduled.attachmentPayload);

    if (!nextBody && !hasAttachment) {
      return reply.badRequest('Informe uma mensagem ou mantenha um anexo para o agendamento.');
    }

    const updated = await app.prisma.scheduledMessage.update({
      where: { id: scheduled.id },
      data: {
        body: nextBody || null,
        sendAt: nextSendAt,
        status: 'pending',
        errorMessage: null,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
            agent: {
              select: {
                name: true,
              },
            },
          },
        },
        ticket: {
          include: {
            currentQueue: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            currentAgent: {
              select: {
                id: true,
                name: true,
              },
            },
            whatsappInstance: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (app.jobs.enabled) {
      await app.jobs.enqueueScheduledMessage(
        { scheduledMessageId: updated.id },
        {
          delayMs: Math.max(0, nextSendAt.getTime() - Date.now()),
          jobId: `scheduled-message-${updated.id}-${nextSendAt.getTime()}`,
        },
      );
    }

    app.io.emit('ticket.updated', {
      ticketId: updated.ticketId,
      scheduledMessageId: updated.id,
    });

    return { item: mapScheduledMessage(updated) };
  });

  app.delete('/scheduled-messages/:scheduledMessageId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      scheduledMessageId: z.string().uuid(),
    }).parse(request.params);

    const scheduled = await app.prisma.scheduledMessage.findUnique({
      where: {
        id: params.scheduledMessageId,
      },
      include: {
        ticket: {
          include: {
            currentAgent: true,
          },
        },
      },
    });

    if (!scheduled) {
      return reply.notFound('Mensagem agendada nao encontrada.');
    }

    if (!canReplyToTicket(session.userId, access.permissions, access.queueIds, scheduled.ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode cancelar mensagens agendadas neste ticket.');
    }

    if (scheduled.status === 'sent') {
      return reply.badRequest('A mensagem agendada ja foi enviada.');
    }

    await app.prisma.scheduledMessage.update({
      where: { id: scheduled.id },
      data: {
        status: 'canceled',
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: scheduled.ticketId,
      canceledScheduledMessageId: scheduled.id,
    });

    return reply.code(200).send({ ok: true });
  });

  app.delete('/tickets/:ticketId/scheduled-messages/:scheduledMessageId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({
      ticketId: z.string().uuid(),
      scheduledMessageId: z.string().uuid(),
    }).parse(request.params);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!canReplyToTicket(session.userId, access.permissions, access.queueIds, ticket)) {
      return reply.forbidden('Apenas o agente responsavel pode cancelar mensagens agendadas neste ticket.');
    }

    const scheduled = await app.prisma.scheduledMessage.findFirst({
      where: {
        id: params.scheduledMessageId,
        ticketId: params.ticketId,
      },
    });

    if (!scheduled) {
      return reply.notFound('Mensagem agendada nao encontrada.');
    }

    if (scheduled.status === 'sent') {
      return reply.badRequest('A mensagem agendada ja foi enviada.');
    }

    await app.prisma.scheduledMessage.update({
      where: { id: scheduled.id },
      data: {
        status: 'canceled',
      },
    });

    app.io.emit('ticket.updated', {
      ticketId: ticket.id,
      canceledScheduledMessageId: scheduled.id,
    });

    return reply.code(200).send({ ok: true });
  });
};
