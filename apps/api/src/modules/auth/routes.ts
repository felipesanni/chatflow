import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { clearSessionCookie, createSessionToken, getSessionFromRequest, setSessionCookie } from '../../lib/session.js';
import { loadEnv } from '../../config/env.js';

const bootstrapBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const env = loadEnv();

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/bootstrap', async (request, reply) => {
    const body = bootstrapBodySchema.parse(request.body);
    const totalUsers = await app.prisma.user.count();

    if (totalUsers > 0) {
      return reply.conflict('Bootstrap is only available before the first user is created.');
    }

    const userId = randomUUID();
    const passwordHash = hashPassword(body.password);

    await app.prisma.user.create({
      data: {
        id: userId,
        email: body.email.toLowerCase(),
        passwordHash,
        role: 'admin',
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
      return reply.internalServerError('Bootstrap user was not persisted.');
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    }, env.SESSION_SECRET);

    setSessionCookie(reply, token, env.NODE_ENV === 'production');

    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.agent?.name ?? body.name,
      },
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const user = await app.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { agent: true },
    });

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return reply.unauthorized('Invalid credentials.');
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    }, env.SESSION_SECRET);

    setSessionCookie(reply, token, env.NODE_ENV === 'production');

    await app.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.agent?.name ?? user.email,
      },
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
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.agent?.name ?? user.email,
      },
    };
  });
};
