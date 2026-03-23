import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Queue, Worker } from 'bullmq';
import { loadEnv } from '../config/env.js';
import { processEvolutionEvent } from '../lib/evolution-events.js';
import { processScheduledMessage } from '../lib/scheduled-messages.js';
import { EVOLUTION_EVENT_QUEUE, SCHEDULED_MESSAGE_QUEUE, type EvolutionEventJobPayload, type ScheduledMessageJobPayload } from '../lib/queue-jobs.js';

interface QueueManager {
  enabled: boolean;
  enqueueEvolutionEvent: (payload: EvolutionEventJobPayload) => Promise<string | null>;
  enqueueScheduledMessage: (payload: ScheduledMessageJobPayload, options?: { delayMs?: number; jobId?: string }) => Promise<string | null>;
}

declare module 'fastify' {
  interface FastifyInstance {
    jobs: QueueManager;
  }
}

export const queuesPlugin = fp(async (app: FastifyInstance) => {
  const env = loadEnv();
  const redisConnection = { url: env.REDIS_URL } as any;

  if (!env.REDIS_URL) {
    app.decorate('jobs', {
      enabled: false,
      enqueueEvolutionEvent: async () => null,
      enqueueScheduledMessage: async () => null,
    });
    app.log.warn('BullMQ desativado: REDIS_URL nao configurada.');
    return;
  }

  const evolutionEventQueue = new Queue<EvolutionEventJobPayload>(EVOLUTION_EVENT_QUEUE, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });

  const scheduledMessageQueue = new Queue<ScheduledMessageJobPayload>(SCHEDULED_MESSAGE_QUEUE, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });

  const evolutionEventWorker = new Worker<EvolutionEventJobPayload>(
    EVOLUTION_EVENT_QUEUE,
    async (job) => {
      const result = await processEvolutionEvent(app, job.data);

      if (result.statusCode >= 400) {
        throw new Error(result.body?.message ?? `Falha ao processar evento da Evolution (${result.statusCode}).`);
      }

      return result.body;
    },
    {
      connection: redisConnection,
      concurrency: env.QUEUE_WEBHOOK_CONCURRENCY,
    },
  );

  const scheduledMessageWorker = new Worker<ScheduledMessageJobPayload>(
    SCHEDULED_MESSAGE_QUEUE,
    async (job) => processScheduledMessage(app, job.data.scheduledMessageId),
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  evolutionEventWorker.on('completed', (job) => {
    app.log.debug({ queue: EVOLUTION_EVENT_QUEUE, jobId: job.id }, 'Job da Evolution processado.');
  });

  evolutionEventWorker.on('failed', (job, error) => {
    app.log.error({ queue: EVOLUTION_EVENT_QUEUE, jobId: job?.id, error }, 'Job da Evolution falhou.');
  });

  scheduledMessageWorker.on('completed', (job) => {
    app.log.debug({ queue: SCHEDULED_MESSAGE_QUEUE, jobId: job.id }, 'Job de mensagem agendada processado.');
  });

  scheduledMessageWorker.on('failed', (job, error) => {
    app.log.error({ queue: SCHEDULED_MESSAGE_QUEUE, jobId: job?.id, error }, 'Job de mensagem agendada falhou.');
  });

  app.decorate('jobs', {
    enabled: true,
    enqueueEvolutionEvent: async (payload: EvolutionEventJobPayload) => {
      const job = await (evolutionEventQueue as any).add('process-evolution-event', payload);
      return job.id ? String(job.id) : null;
    },
    enqueueScheduledMessage: async (payload: ScheduledMessageJobPayload, options?: { delayMs?: number; jobId?: string }) => {
      const job = await (scheduledMessageQueue as any).add('process-scheduled-message', payload, {
        delay: Math.max(0, options?.delayMs ?? 0),
        jobId: options?.jobId,
      });

      return job.id ? String(job.id) : null;
    },
  });

  app.addHook('onClose', async () => {
    await scheduledMessageWorker.close();
    await evolutionEventWorker.close();
    await scheduledMessageQueue.close();
    await evolutionEventQueue.close();
  });
});
