import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { clearSessionCookie, createSessionToken, getSessionFromRequest, setSessionCookie } from '../../lib/session.js';
import { loadEnv } from '../../config/env.js';
import { defaultPermissionsForRole, resolvePermissions } from '../../lib/permissions.js';
import { requireSession } from '../../lib/auth-guard.js';

const bootstrapBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const dataUrlSchema = z
  .string()
  .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, 'Envie uma imagem valida.')
  .max(2_500_000, 'A imagem do avatar excede o tamanho permitido.');

const updateProfileBodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  avatarUrl: z.union([dataUrlSchema, z.literal(''), z.null()]).optional(),
});

const env = loadEnv();

function serializeAuthenticatedUser(user: {
  id: string;
  email: string;
  role: 'admin' | 'agent';
  permissions: unknown;
  agent: { name: string; avatarUrl: string | null } | null;
}, fallbackName?: string) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.agent?.name ?? fallbackName ?? user.email,
    avatarUrl: user.agent?.avatarUrl ?? null,
    permissions: resolvePermissions(user.role, user.permissions as never),
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/bootstrap', async (request, reply) => {
    const body = bootstrapBodySchema.parse(request.body);
    const totalUsers = await app.prisma.user.count();

    if (totalUsers > 0) {
      return reply.conflict('A criacao inicial so esta disponivel antes do primeiro usuario ser cadastrado.');
    }

    const userId = randomUUID();
    const passwordHash = hashPassword(body.password);

    await app.prisma.user.create({
      data: {
        id: userId,
        email: body.email.toLowerCase(),
        passwordHash,
        role: 'admin',
        permissions: defaultPermissionsForRole('admin'),
        status: 'active',
        agent: {
          create: {
            name: body.name,
            presence: 'online',
          },
        },
      },
    });

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: { agent: true },
    });

    if (!user) {
      return reply.internalServerError('Nao foi possivel persistir o usuario inicial.');
    }

    const token = createSessionToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      env.SESSION_SECRET,
    );

    setSessionCookie(reply, token, env.NODE_ENV === 'production');

    return reply.code(201).send({
      user: serializeAuthenticatedUser(user, body.name),
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const user = await app.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { agent: true },
    });

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return reply.unauthorized('Credenciais invalidas.');
    }

    const token = createSessionToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      env.SESSION_SECRET,
    );

    setSessionCookie(reply, token, env.NODE_ENV === 'production');

    await app.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: serializeAuthenticatedUser(user),
    };
  });

  app.post('/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply, env.NODE_ENV === 'production');
    return reply.code(204).send();
  });

  app.get('/auth/me', async (request) => {
    const session = getSessionFromRequest(request, env.SESSION_SECRET);

    if (!session) {
      return {
        authenticated: false,
      };
    }

    const user = await app.prisma.user.findUnique({
      where: { id: session.userId },
      include: { agent: true },
    });

    if (!user) {
      return {
        authenticated: false,
      };
    }

    return {
      authenticated: true,
      user: serializeAuthenticatedUser(user),
    };
  });

  app.patch('/auth/me/profile', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const body = updateProfileBodySchema.parse(request.body);
    const existing = await app.prisma.user.findUnique({
      where: { id: session.userId },
      include: { agent: true },
    });

    if (!existing || !existing.agent) {
      return reply.notFound('Perfil do agente nao encontrado.');
    }

    const normalizedAvatarUrl =
      body.avatarUrl === ''
        ? null
        : body.avatarUrl === undefined
          ? existing.agent.avatarUrl
          : body.avatarUrl;

    await app.prisma.agent.update({
      where: { id: existing.agent.id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        avatarUrl: normalizedAvatarUrl,
      },
    });

    const updated = await app.prisma.user.findUnique({
      where: { id: session.userId },
      include: { agent: true },
    });

    if (!updated) {
      return reply.internalServerError('Nao foi possivel atualizar o perfil.');
    }

    app.io.emit('agent.updated', { agentId: updated.id, action: 'profile_updated' });

    return reply.code(200).send({
      message: 'Perfil atualizado com sucesso.',
      user: serializeAuthenticatedUser(updated),
    });
  });
};
