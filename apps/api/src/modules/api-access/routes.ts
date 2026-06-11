import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';
import { buildApiAccessTokenPrefix, createApiAccessTokenValue, hashApiAccessToken } from '../../lib/api-access-tokens.js';

const createApiAccessTokenBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
});

const apiTokenParamsSchema = z.object({
  tokenId: z.string().uuid(),
});

export const apiAccessRoutes: FastifyPluginAsync = async (app) => {
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
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        tokenPrefix: item.tokenPrefix,
        isActive: item.isActive,
        lastUsedAt: item.lastUsedAt,
        createdAt: item.createdAt,
        createdBy: item.createdByUser
          ? {
              id: item.createdByUser.id,
              name: item.createdByUser.agent?.name ?? item.createdByUser.email,
            }
          : null,
      })),
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
      item: {
        id: item.id,
        name: item.name,
        tokenPrefix: item.tokenPrefix,
        isActive: item.isActive,
        lastUsedAt: item.lastUsedAt,
        createdAt: item.createdAt,
        createdBy: item.createdByUser
          ? {
              id: item.createdByUser.id,
              name: item.createdByUser.agent?.name ?? item.createdByUser.email,
            }
          : null,
      },
      token: rawToken,
      message: 'Token criado com sucesso. Guarde este valor agora, ele nao sera exibido novamente.',
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
