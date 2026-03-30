import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

const webPushEnabled = Boolean(
  env.WEB_PUSH_VAPID_PUBLIC_KEY
  && env.WEB_PUSH_VAPID_PRIVATE_KEY
  && env.WEB_PUSH_SUBJECT,
);

if (webPushEnabled) {
  webpush.setVapidDetails(
    env.WEB_PUSH_SUBJECT!,
    env.WEB_PUSH_VAPID_PUBLIC_KEY!,
    env.WEB_PUSH_VAPID_PRIVATE_KEY!,
  );
}

export function getBrowserPushConfig() {
  return {
    enabled: webPushEnabled,
    publicKey: webPushEnabled ? env.WEB_PUSH_VAPID_PUBLIC_KEY! : null,
  };
}

export type BrowserPushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type BrowserPushPayload = {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
};

function toWebPushSubscription(subscription: BrowserPushSubscriptionInput) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };
}

export async function saveBrowserPushSubscription(
  app: FastifyInstance,
  userId: string,
  subscription: BrowserPushSubscriptionInput,
  userAgent?: string | null,
) {
  const savedSubscription = await app.prisma.browserPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      id: randomUUID(),
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
      lastUsedAt: new Date(),
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
      lastUsedAt: new Date(),
    },
  });

  app.log.info(
    {
      action: 'browser_push_subscription_saved',
      userId,
      endpoint: subscription.endpoint,
    },
    'Subscription de web push registrada para o usuario.',
  );

  return savedSubscription;
}

export async function deleteBrowserPushSubscription(app: FastifyInstance, endpoint: string, userId?: string) {
  const where = userId
    ? { endpoint, userId }
    : { endpoint };

  await app.prisma.browserPushSubscription.deleteMany({ where });
}

async function notifyBrowserPushSubscription(
  app: FastifyInstance,
  subscription: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: BrowserPushPayload,
) {
  try {
    await webpush.sendNotification(
      toWebPushSubscription({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }),
      JSON.stringify(payload),
    );

    await app.prisma.browserPushSubscription.update({
      where: { id: subscription.id },
      data: { lastUsedAt: new Date() },
    });
  } catch (error) {
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : null;

    if (statusCode === 404 || statusCode === 410) {
      await app.prisma.browserPushSubscription.delete({
        where: { id: subscription.id },
      }).catch(() => null);
      return;
    }

    app.log.error(
      {
        action: 'browser_push_delivery_failed',
        subscriptionId: subscription.id,
        endpoint: subscription.endpoint,
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      },
      'Falha ao enviar notificacao web push.',
    );
  }
}

export async function sendBrowserPushToUsers(
  app: FastifyInstance,
  userIds: string[],
  payload: BrowserPushPayload,
) {
  if (!webPushEnabled || userIds.length === 0) {
    return;
  }

  const uniqueUserIds = Array.from(new Set(userIds));

  const subscriptions = await app.prisma.browserPushSubscription.findMany({
    where: {
      userId: {
        in: uniqueUserIds,
      },
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    app.log.info(
      {
        action: 'browser_push_skipped_without_subscriptions',
        requestedUserIds: uniqueUserIds,
        title: payload.title,
        tag: payload.tag,
      },
      'Nenhuma subscription ativa encontrada para enviar notificacao web push.',
    );
    return;
  }

  app.log.info(
    {
      action: 'browser_push_dispatch_started',
      requestedUserIds: uniqueUserIds,
      matchedSubscriptions: subscriptions.length,
      title: payload.title,
      tag: payload.tag,
    },
    'Enviando notificacao web push para subscriptions registradas.',
  );

  await Promise.all(subscriptions.map((subscription) => notifyBrowserPushSubscription(app, subscription, payload)));
}
