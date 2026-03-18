import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadEnv } from './config/env.js';
import { prismaPlugin } from './plugins/prisma.js';
import { realtimePlugin } from './plugins/realtime.js';
import { evolutionSocketsPlugin } from './plugins/evolution-sockets.js';
import { ensureBootstrapAdmin } from './lib/bootstrap-admin.js';
import { ensureOperationalSchema } from './lib/ensure-operational-schema.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { agentRoutes } from './modules/agents/routes.js';
import { customerRoutes } from './modules/customers/routes.js';
import { quickReplyRoutes } from './modules/quick-replies/routes.js';
import { queueRoutes } from './modules/queues/routes.js';
import { ticketRoutes } from './modules/tickets/routes.js';
import { messageRoutes } from './modules/messages/routes.js';
import { whatsappRoutes } from './modules/whatsapp/routes.js';

export async function buildApp() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.API_LOG_LEVEL,
    },
  });

  await app.register(sensible);
  await app.register(cookie, {
    secret: env.SESSION_SECRET,
  });
  await app.register(cors, {
    origin: [env.WEB_APP_URL],
    credentials: true,
  });

  await app.register(prismaPlugin);
  await app.register(realtimePlugin, {
    corsOrigin: env.WEB_APP_URL,
  });
  await ensureOperationalSchema(app);
  await ensureBootstrapAdmin(app, env);
  await app.register(evolutionSocketsPlugin);

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(agentRoutes, { prefix: '/api' });
  await app.register(customerRoutes, { prefix: '/api' });
  await app.register(quickReplyRoutes, { prefix: '/api' });
  await app.register(queueRoutes, { prefix: '/api' });
  await app.register(ticketRoutes, { prefix: '/api' });
  await app.register(messageRoutes, { prefix: '/api' });
  await app.register(whatsappRoutes, { prefix: '/api' });

  return app;
}
