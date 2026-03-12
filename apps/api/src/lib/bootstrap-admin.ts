import { randomUUID } from 'node:crypto';
import { hashPassword } from './password.js';
import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '../config/env.js';

export async function ensureBootstrapAdmin(app: FastifyInstance, env: AppEnv) {
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD || !env.ADMIN_BOOTSTRAP_NAME) {
    return;
  }

  const userCount = await app.prisma.user.count();
  if (userCount > 0) {
    return;
  }

  const userId = randomUUID();

  await app.prisma.user.create({
    data: {
      id: userId,
      email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase(),
      passwordHash: hashPassword(env.ADMIN_BOOTSTRAP_PASSWORD),
      role: 'admin',
      status: 'active',
      agent: {
        create: {
          id: userId,
          name: env.ADMIN_BOOTSTRAP_NAME,
          presence: 'online',
        },
      },
    },
  });

  app.log.info({ email: env.ADMIN_BOOTSTRAP_EMAIL }, 'Bootstrap admin created from environment');
}
