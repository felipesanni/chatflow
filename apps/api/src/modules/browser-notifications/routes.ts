import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import {
  getBrowserPushConfig,
  saveBrowserPushSubscription,
  deleteBrowserPushSubscription,
  deleteAllBrowserPushSubscriptions,
  sendBrowserPushToUsers,
} from '../../lib/browser-push.js';
import { requireSession } from '../../lib/auth-guard.js';

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('Endpoint de notificacao invalido.'),
  keys: z.object({
    p256dh: z.string().min(1, 'Chave p256dh obrigatoria.'),
    auth: z.string().min(1, 'Chave auth obrigatoria.'),
  }),
});

const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url('Endpoint de notificacao invalido.'),
});

export const browserNotificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/browser-notifications/config', async () => {
    return getBrowserPushConfig();
  });

  app.get('/browser-notifications/status', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const config = getBrowserPushConfig();
    const subscriptions = await app.prisma.browserPushSubscription.findMany({
      where: {
        userId: session.userId,
      },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      enabled: config.enabled,
      publicKeyAvailable: Boolean(config.publicKey),
      userId: session.userId,
      subscriptionCount: subscriptions.length,
      subscriptions,
    };
  });

  app.post('/browser-notifications/subscriptions', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const config = getBrowserPushConfig();
    if (!config.enabled || !config.publicKey) {
      return reply.serviceUnavailable('As notificacoes push ainda nao foram configuradas neste ambiente.');
    }

    const body = pushSubscriptionSchema.parse(request.body);

    await saveBrowserPushSubscription(
      app,
      session.userId,
      body,
      typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
    );

    return reply.code(201).send({
      message: 'Dispositivo registrado para notificacoes.',
    });
  });

  app.post('/browser-notifications/test', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const config = getBrowserPushConfig();
    if (!config.enabled || !config.publicKey) {
      return reply.serviceUnavailable('As notificacoes push ainda nao foram configuradas neste ambiente.');
    }

    const dispatch = await sendBrowserPushToUsers(app, [session.userId], {
      title: 'Teste de notificacao do ChatFlow',
      body: 'Se voce viu isso, o push do navegador/PWA esta funcionando.',
      tag: `browser-push-test:${session.userId}`,
      data: {
        url: '/',
        source: 'manual-test',
      },
    });

    return reply.code(200).send({
      message: 'Teste de notificacao executado.',
      dispatch,
    });
  });

  app.delete('/browser-notifications/subscriptions', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const body = deletePushSubscriptionSchema.safeParse(request.body);

    if (body.success) {
      await deleteBrowserPushSubscription(app, body.data.endpoint, session.userId);
      return reply.code(204).send();
    }

    await deleteAllBrowserPushSubscriptions(app, session.userId);

    return reply.code(204).send();
  });
};
