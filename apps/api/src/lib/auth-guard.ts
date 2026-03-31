import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loadEnv } from '../config/env.js';
import { getSessionFromRequest } from './session.js';
import { hasPermission, resolvePermissions, type PermissionKey } from './permissions.js';

const env = loadEnv();
const ACCESS_TIMEZONE = 'America/Sao_Paulo';
const ACCESS_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type AccessControlledUser = {
  status: 'active' | 'inactive';
  accessStartTime?: string | null;
  accessEndTime?: string | null;
};

function resolveCurrentMinuteInTimezone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ACCESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return hour * 60 + minute;
}

function parseAccessTimeToMinute(value: string) {
  const match = ACCESS_TIME_PATTERN.exec(value);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function isWithinAllowedWindow(startMinute: number, endMinute: number, currentMinute: number) {
  if (startMinute === endMinute) return true;
  if (startMinute < endMinute) {
    return currentMinute >= startMinute && currentMinute < endMinute;
  }

  return currentMinute >= startMinute || currentMinute < endMinute;
}

export function describeUserAccessRestriction(user: AccessControlledUser, date = new Date()) {
  if (user.status !== 'active') {
    return 'Este usuário está bloqueado para acessar o sistema.';
  }

  if (!user.accessStartTime || !user.accessEndTime) {
    return null;
  }

  const startMinute = parseAccessTimeToMinute(user.accessStartTime);
  const endMinute = parseAccessTimeToMinute(user.accessEndTime);

  if (startMinute === null || endMinute === null) {
    return null;
  }

  const currentMinute = resolveCurrentMinuteInTimezone(date);

  if (isWithinAllowedWindow(startMinute, endMinute, currentMinute)) {
    return null;
  }

  return `Acesso permitido somente entre ${user.accessStartTime} e ${user.accessEndTime}.`;
}

export function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const session = getSessionFromRequest(request, env.SESSION_SECRET);

  if (!session) {
    reply.unauthorized('Autenticacao obrigatoria.');
    return null;
  }

  return session;
}

export async function requirePermission(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  permission: PermissionKey | PermissionKey[],
) {
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
      status: true,
      accessStartTime: true,
      accessEndTime: true,
      agent: {
        select: {
          queueLinks: {
            select: {
              queueId: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    reply.unauthorized('Sessao invalida.');
    return null;
  }

  const accessRestriction = describeUserAccessRestriction(user);
  if (accessRestriction) {
    reply.forbidden(accessRestriction);
    return null;
  }

  const requiredPermissions = Array.isArray(permission) ? permission : [permission];
  const allowed = requiredPermissions.some((item) => hasPermission(user.role, user.permissions, item));

  if (!allowed) {
    reply.forbidden('Voce nao possui permissao para executar esta acao.');
    return null;
  }

  return {
    session,
    user,
    permissions: resolvePermissions(user.role, user.permissions),
    queueIds: user.agent?.queueLinks.map((link) => link.queueId) ?? [],
  };
}
