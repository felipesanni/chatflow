import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loadEnv } from '../config/env.js';
import { getSessionFromRequest } from './session.js';
import { hasPermission, resolvePermissions, type PermissionKey } from './permissions.js';

const env = loadEnv();

export function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const session = getSessionFromRequest(request, env.SESSION_SECRET);

  if (!session) {
    reply.unauthorized('Autenticacao obrigatoria.');
    return null;
  }

  return session;
}

export async function requirePermission(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, permission: PermissionKey) {
  const session = requireSession(request, reply);

  if (!session) {
    return null;
  }

  const user = await app.prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      permissions: true,
    },
  });

  if (!user) {
    reply.unauthorized('Sessao invalida.');
    return null;
  }

  if (!hasPermission(user.role, user.permissions, permission)) {
    reply.forbidden('Voce nao possui permissao para executar esta acao.');
    return null;
  }

  return {
    session,
    user,
    permissions: resolvePermissions(user.role, user.permissions),
  };
}
