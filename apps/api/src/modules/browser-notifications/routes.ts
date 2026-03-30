import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { getBrowserPushConfig, saveBrowserPushSubscription, deleteBrowserPushSubscription } from '../../lib/browser-push.js';
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

  app.delete('/browser-notifications/subscriptions', async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const body = deletePushSubscriptionSchema.parse(request.body);
    await deleteBrowserPushSubscription(app, body.endpoint, session.userId);

    return reply.code(204).send();
  });
};
