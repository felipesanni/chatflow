import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';
import { buildApiAccessTokenPrefix, createApiAccessTokenValue, hashApiAccessToken } from '../../lib/api-access-tokens.js';

const createApiAccessTokenBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  accessMode: z.enum(['read', 'read_write']).default('read'),
  canMergeTickets: z.boolean().default(false),
  allowedQueueIds: z.array(z.string().uuid()).default([]),
  allowedAgentIds: z.array(z.string().uuid()).default([]),
  allowedInstanceIds: z.array(z.string().uuid()).default([]),
});

const updateApiAccessTokenBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  accessMode: z.enum(['read', 'read_write']).optional(),
  canMergeTickets: z.boolean().optional(),
  allowedQueueIds: z.array(z.string().uuid()).optional(),
  allowedAgentIds: z.array(z.string().uuid()).optional(),
  allowedInstanceIds: z.array(z.string().uuid()).optional(),
}).refine((value) => value.name !== undefined || value.accessMode !== undefined || value.canMergeTickets !== undefined
  || value.allowedQueueIds !== undefined || value.allowedAgentIds !== undefined || value.allowedInstanceIds !== undefined, {
  message: 'Informe ao menos uma propriedade para atualizar o token.',
});

const apiTokenParamsSchema = z.object({
  tokenId: z.string().uuid(),
});

function serializeApiAccessToken(item: {
  id: string;
  name: string;
  tokenPrefix: string;
  accessMode: string;
  canMergeTickets: boolean;
  allowedQueueIds: string[];
  allowedAgentIds: string[];
  allowedInstanceIds: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  createdByUser: { id: string; email: string; agent: { name: string } | null } | null;
}) {
  return {
    id: item.id,
    name: item.name,
    tokenPrefix: item.tokenPrefix,
    accessMode: item.accessMode === 'read_write' ? 'read_write' : 'read',
    canMergeTickets: item.canMergeTickets,
    allowedQueueIds: item.allowedQueueIds,
    allowedAgentIds: item.allowedAgentIds,
    allowedInstanceIds: item.allowedInstanceIds,
    isActive: item.isActive,
    lastUsedAt: item.lastUsedAt,
    createdAt: item.createdAt,
    createdBy: item.createdByUser
      ? {
          id: item.createdByUser.id,
          name: item.createdByUser.agent?.name ?? item.createdByUser.email,
        }
      : null,
  };
}

export const apiAccessRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api-access/scope-options', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'api.manage');
    if (!access) return;

    const [queues, agents, instances] = await Promise.all([
      app.prisma.queue.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      app.prisma.agent.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      app.prisma.whatsAppInstance.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    return { queues, agents, instances };
  });

  app.get('/api-access/tokens', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'api.manage');
    if (!access) return;

    const items = await app.prisma.apiAccessToken.findMany({
      include: {
        createdByUser: {
          include: {
            agent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: items.map(serializeApiAccessToken),
    };
  });

  app.post('/api-access/tokens', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'api.manage');
    if (!access) return;

    const body = createApiAccessTokenBodySchema.parse(request.body);
    const rawToken = createApiAccessTokenValue();
    const tokenHash = hashApiAccessToken(rawToken);

    const item = await app.prisma.apiAccessToken.create({
      data: {
        id: randomUUID(),
        name: body.name,
        accessMode: body.accessMode,
        canMergeTickets: body.canMergeTickets,
        allowedQueueIds: body.allowedQueueIds,
        allowedAgentIds: body.allowedAgentIds,
        allowedInstanceIds: body.allowedInstanceIds,
        tokenHash,
        tokenPrefix: buildApiAccessTokenPrefix(rawToken),
        createdByUserId: access.session.userId,
      },
      include: {
        createdByUser: {
          include: {
            agent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return reply.code(201).send({
      item: serializeApiAccessToken(item),
      token: rawToken,
      message: 'Token criado com sucesso. Guarde este valor agora, ele nao sera exibido novamente.',
    });
  });

  app.patch('/api-access/tokens/:tokenId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'api.manage');
    if (!access) return;

    const params = apiTokenParamsSchema.parse(request.params);
    const body = updateApiAccessTokenBodySchema.parse(request.body ?? {});

    const existing = await app.prisma.apiAccessToken.findUnique({
      where: { id: params.tokenId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Token nao encontrado.');
    }

    const item = await app.prisma.apiAccessToken.update({
      where: { id: params.tokenId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.accessMode !== undefined ? { accessMode: body.accessMode } : {}),
        ...(body.canMergeTickets !== undefined ? { canMergeTickets: body.canMergeTickets } : {}),
        ...(body.allowedQueueIds !== undefined ? { allowedQueueIds: body.allowedQueueIds } : {}),
        ...(body.allowedAgentIds !== undefined ? { allowedAgentIds: body.allowedAgentIds } : {}),
        ...(body.allowedInstanceIds !== undefined ? { allowedInstanceIds: body.allowedInstanceIds } : {}),
      },
      include: {
        createdByUser: {
          include: {
            agent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return reply.code(200).send({
      item: serializeApiAccessToken(item),
      message: 'Permissoes do token atualizadas com sucesso.',
    });
  });

  app.delete('/api-access/tokens/:tokenId', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'api.manage');
    if (!access) return;

    const params = apiTokenParamsSchema.parse(request.params);

    const existing = await app.prisma.apiAccessToken.findUnique({
      where: { id: params.tokenId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Token nao encontrado.');
    }

    await app.prisma.apiAccessToken.delete({
      where: { id: params.tokenId },
    });

    return reply.code(200).send({
      message: 'Token removido com sucesso.',
    });
  });
};
