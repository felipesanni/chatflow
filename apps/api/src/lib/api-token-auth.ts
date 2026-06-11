import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { parseBearerToken, hashApiAccessToken } from './api-access-tokens.js';

export async function requireApiAccessToken(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
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

  void app.prisma.apiAccessToken.update({
    where: { id: accessToken.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return accessToken;
}
