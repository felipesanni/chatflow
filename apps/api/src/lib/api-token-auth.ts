import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { parseBearerToken, hashApiAccessToken } from './api-access-tokens.js';

export type ApiAccessMode = 'read' | 'read_write';

export type ApiTokenRequiredAccess = 'read' | 'write' | 'merge';

export type ApiTokenScope = {
  allowedQueueIds: string[];
  allowedAgentIds: string[];
  allowedInstanceIds: string[];
};

export function buildApiTokenTicketScopeWhere(accessToken: ApiTokenScope): Prisma.TicketWhereInput[] {
  const filters: Prisma.TicketWhereInput[] = [];

  if (accessToken.allowedQueueIds.length > 0) {
    filters.push({ currentQueueId: { in: accessToken.allowedQueueIds } });
  }

  if (accessToken.allowedAgentIds.length > 0) {
    filters.push({ currentAgentId: { in: accessToken.allowedAgentIds } });
  }

  if (accessToken.allowedInstanceIds.length > 0) {
    filters.push({ whatsappInstanceId: { in: accessToken.allowedInstanceIds } });
  }

  return filters;
}

export function apiTokenCanAccessTicket(
  accessToken: ApiTokenScope,
  ticket: { currentQueueId: string | null; currentAgentId: string | null; whatsappInstanceId: string },
) {
  return (accessToken.allowedQueueIds.length === 0 || Boolean(ticket.currentQueueId && accessToken.allowedQueueIds.includes(ticket.currentQueueId)))
    && (accessToken.allowedAgentIds.length === 0 || Boolean(ticket.currentAgentId && accessToken.allowedAgentIds.includes(ticket.currentAgentId)))
    && (accessToken.allowedInstanceIds.length === 0 || accessToken.allowedInstanceIds.includes(ticket.whatsappInstanceId));
}

export function apiTokenCanAccessTarget(
  accessToken: ApiTokenScope,
  kind: 'queue' | 'agent' | 'instance',
  id: string,
) {
  const allowedIds = kind === 'queue'
    ? accessToken.allowedQueueIds
    : kind === 'agent'
      ? accessToken.allowedAgentIds
      : accessToken.allowedInstanceIds;

  return allowedIds.length === 0 || allowedIds.includes(id);
}

export async function requireApiAccessToken(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  requiredAccess: ApiTokenRequiredAccess = 'read',
) {
  const token = parseBearerToken(request.headers.authorization);

  if (!token) {
    reply.unauthorized('Token Bearer obrigatorio.');
    return null;
  }

  const tokenHash = hashApiAccessToken(token);
  const accessToken = await app.prisma.apiAccessToken.findUnique({
    where: { tokenHash },
    include: {
      createdByUser: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!accessToken || !accessToken.isActive) {
    reply.unauthorized('Token de API invalido ou inativo.');
    return null;
  }

  if (requiredAccess === 'write' && accessToken.accessMode !== 'read_write') {
    reply.forbidden('Este token esta configurado como somente leitura.');
    return null;
  }

  if (requiredAccess === 'merge' && !accessToken.canMergeTickets) {
    reply.forbidden('Este token nao possui permissao para mesclar tickets.');
    return null;
  }

  void app.prisma.apiAccessToken.update({
    where: { id: accessToken.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return accessToken;
}
