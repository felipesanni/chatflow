import type { FastifyInstance } from 'fastify';
import { sendBrowserPushToUsers } from './browser-push.js';

function buildTicketUrl(ticketId: string) {
  return `/?ticketId=${encodeURIComponent(ticketId)}`;
}

function toAbsoluteAppUrl(path: string) {
  const baseUrl = process.env.WEB_APP_URL?.trim() || '';
  if (!baseUrl) return path;

  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

export async function notifyInboundTicketMessage(
  app: FastifyInstance,
  params: {
    ticketId: string;
    preview: string | null;
  },
) {
  const ticket = await app.prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: {
      id: true,
      customerNameSnapshot: true,
      customerAvatarUrl: true,
      currentAgentId: true,
      currentQueue: {
        select: {
          queueAgents: {
            select: {
              agentId: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    app.log.info(
      {
        action: 'browser_push_ticket_not_found',
        ticketId: params.ticketId,
      },
      'Ticket nao encontrado ao preparar notificacao inbound.',
    );
    return;
  }

  const recipientUserIds = ticket.currentAgentId
    ? [ticket.currentAgentId]
    : ticket.currentQueue?.queueAgents.map((link) => link.agentId) ?? [];

  if (recipientUserIds.length === 0) {
    app.log.info(
      {
        action: 'browser_push_skipped_without_recipients',
        ticketId: ticket.id,
      },
      'Nenhum destinatario elegivel para notificacao inbound.',
    );
    return;
  }

  app.log.info(
    {
      action: 'browser_push_inbound_notification_prepared',
      ticketId: ticket.id,
      recipientUserIds,
      preview: params.preview,
    },
    'Preparando notificacao web push para mensagem inbound.',
  );

  await sendBrowserPushToUsers(app, recipientUserIds, {
    title: ticket.customerNameSnapshot
      ? `Nova mensagem de ${ticket.customerNameSnapshot}`
      : 'Nova mensagem no ChatFlow',
    body: params.preview?.trim() || 'Nova mensagem recebida.',
    tag: `ticket:${ticket.id}`,
    icon: ticket.customerAvatarUrl || toAbsoluteAppUrl('/favicon.ico'),
    badge: toAbsoluteAppUrl('/favicon.ico'),
    data: {
      ticketId: ticket.id,
      url: buildTicketUrl(ticket.id),
      customerName: ticket.customerNameSnapshot,
    },
  });
}
