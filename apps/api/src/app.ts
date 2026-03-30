import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadEnv } from './config/env.js';
import { prismaPlugin } from './plugins/prisma.js';
import { queuesPlugin } from './plugins/queues.js';
import { realtimePlugin } from './plugins/realtime.js';
import { evolutionSocketsPlugin } from './plugins/evolution-sockets.js';
import { ensureBootstrapAdmin } from './lib/bootstrap-admin.js';
import { ensureOperationalSchema } from './lib/ensure-operational-schema.js';
import { createEvolutionDebugMonitor } from './lib/evolution-debug.js';
import { healthRoutes } from './modules/health/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { agentRoutes } from './modules/agents/routes.js';
import { customerRoutes } from './modules/customers/routes.js';
import { quickReplyRoutes } from './modules/quick-replies/routes.js';
import { queueRoutes } from './modules/queues/routes.js';
import { ticketRoutes } from './modules/tickets/routes.js';
import { messageRoutes } from './modules/messages/routes.js';
import { scheduledMessageRoutes } from './modules/scheduled-messages/routes.js';
import { whatsappRoutes } from './modules/whatsapp/routes.js';
import { apiAccessRoutes } from './modules/api-access/routes.js';
import { externalRoutes } from './modules/external/routes.js';
import { browserNotificationRoutes } from './modules/browser-notifications/routes.js';

export async function buildApp() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.API_LOG_LEVEL,
    },
    bodyLimit: 50 * 1024 * 1024,
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
  await app.register(queuesPlugin);
  await app.register(realtimePlugin, {
    corsOrigin: env.WEB_APP_URL,
  });
  app.decorate('evolutionDebug', createEvolutionDebugMonitor());
  await ensureOperationalSchema(app);
  await ensureBootstrapAdmin(app, env);
  await app.register(evolutionSocketsPlugin);

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(dashboardRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(agentRoutes, { prefix: '/api' });
  await app.register(customerRoutes, { prefix: '/api' });
  await app.register(quickReplyRoutes, { prefix: '/api' });
  await app.register(queueRoutes, { prefix: '/api' });
  await app.register(ticketRoutes, { prefix: '/api' });
  await app.register(messageRoutes, { prefix: '/api' });
  await app.register(scheduledMessageRoutes, { prefix: '/api' });
  await app.register(whatsappRoutes, { prefix: '/api' });
  await app.register(apiAccessRoutes, { prefix: '/api' });
  await app.register(externalRoutes, { prefix: '/api' });
  await app.register(browserNotificationRoutes, { prefix: '/api' });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const normalizedError = typeof error === 'object' && error !== null
      ? error as { statusCode?: number; code?: string; message?: string }
      : {};

    const statusCode = typeof normalizedError.statusCode === 'number'
      ? normalizedError.statusCode
      : 500;

    const message = (() => {
      if (normalizedError.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        return 'O arquivo ou conteudo enviado e grande demais para ser processado.';
      }

      if (normalizedError.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
        return 'Tipo de conteudo nao suportado para esta operacao.';
      }

      if (
        normalizedError.message === 'Request body is too large'
        || (typeof normalizedError.message === 'string' && /body.+too large/i.test(normalizedError.message))
      ) {
        return 'O arquivo ou conteudo enviado e grande demais para ser processado.';
      }

      if (normalizedError.message === 'Unsupported Media Type') {
        return 'Tipo de conteudo nao suportado para esta operacao.';
      }

      if (normalizedError.message === 'Unauthorized') {
        return 'Acesso nao autorizado.';
      }

      if (normalizedError.message === 'Forbidden') {
        return 'Voce nao possui permissao para executar esta acao.';
      }

      if (normalizedError.message === 'Not Found') {
        return 'Recurso nao encontrado.';
      }

      if (statusCode >= 500) {
        return 'Ocorreu um erro interno ao processar a solicitacao.';
      }

      return normalizedError.message || 'Nao foi possivel concluir a solicitacao.';
    })();

    if (!reply.sent) {
      void reply.code(statusCode).send({ message });
    }
  });

  return app;
}
