import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Queue, Worker } from 'bullmq';
import { loadEnv } from '../config/env.js';
import { processEvolutionEvent } from '../lib/evolution-events.js';
import { EVOLUTION_EVENT_QUEUE, type EvolutionEventJobPayload } from '../lib/queue-jobs.js';

interface QueueManager {
  enabled: boolean;
  enqueueEvolutionEvent: (payload: EvolutionEventJobPayload) => Promise<string | null>;
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

  evolutionEventWorker.on('completed', (job) => {
    app.log.debug({ queue: EVOLUTION_EVENT_QUEUE, jobId: job.id }, 'Job da Evolution processado.');
  });

  evolutionEventWorker.on('failed', (job, error) => {
    app.log.error({ queue: EVOLUTION_EVENT_QUEUE, jobId: job?.id, error }, 'Job da Evolution falhou.');
  });

  app.decorate('jobs', {
    enabled: true,
    enqueueEvolutionEvent: async (payload: EvolutionEventJobPayload) => {
      const job = await (evolutionEventQueue as any).add('process-evolution-event', payload);
      return job.id ? String(job.id) : null;
    },
  });

  app.addHook('onClose', async () => {
    await evolutionEventWorker.close();
    await evolutionEventQueue.close();
  });
});
