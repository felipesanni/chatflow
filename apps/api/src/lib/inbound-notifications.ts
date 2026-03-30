import type { FastifyInstance } from 'fastify';
import { sendBrowserPushToUsers } from './browser-push.js';

function buildTicketUrl(ticketId: string) {
  return `/?ticketId=${encodeURIComponent(ticketId)}`;
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
    return;
  }

  const recipientUserIds = ticket.currentAgentId
    ? [ticket.currentAgentId]
    : ticket.currentQueue?.queueAgents.map((link) => link.agentId) ?? [];

  if (recipientUserIds.length === 0) {
    return;
  }

  await sendBrowserPushToUsers(app, recipientUserIds, {
    title: ticket.customerNameSnapshot || 'Nova mensagem',
    body: params.preview?.trim() || 'Nova mensagem recebida.',
    tag: `ticket:${ticket.id}`,
    data: {
      ticketId: ticket.id,
      url: buildTicketUrl(ticket.id),
    },
  });
}
