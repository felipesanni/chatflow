import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';
import { loadEnv } from '../../config/env.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';
import { configureEvolutionWebSocket } from '../../lib/evolution-client.js';
import { pickEvolutionIncomingSecret, processEvolutionEvent } from '../../lib/evolution-events.js';

const webhookBodySchema = z.object({
  event: z.string().optional(),
  instance: z.string().optional(),
}).passthrough();

const optionalWebhookSecretSchema = z.string().trim().optional().transform((value) => {
  if (!value) return undefined;
  return value;
});

const createInstanceSchema = z.object({
  name: z.string().min(2),
  evolutionInstanceName: z.string().min(2),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  webhookSecret: optionalWebhookSecretSchema,
});

const updateInstanceSchema = z.object({
  name: z.string().min(2),
  evolutionInstanceName: z.string().min(2),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).optional().or(z.literal('')),
  webhookSecret: optionalWebhookSecretSchema,
});

const env = loadEnv();

export const whatsappRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhooks/evolution', async (request, reply) => {
    const body = webhookBodySchema.parse(request.body);
    const query = (request.query ?? {}) as Record<string, unknown>;
    const jobPayload = {
      source: 'evolution',
      payload: body,
      incomingSecret: pickEvolutionIncomingSecret(request.headers, query),
      validateSecret: true,
    };

    if (app.jobs.enabled) {
      const jobId = await app.jobs.enqueueEvolutionEvent(jobPayload);
      return reply.code(202).send({
        queued: true,
        jobId,
      });
    }

    const result = await processEvolutionEvent(app, jobPayload);
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/whatsapp/instances', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'channels.view'))) return;

    const items = await app.prisma.whatsAppInstance.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        evolutionInstanceName: true,
        baseUrl: true,
        status: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.send({ items });
  });

  app.post('/whatsapp/instances', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'channels.manage'))) return;

    const body = createInstanceSchema.parse(request.body);
    const websocketSetup = await configureEvolutionWebSocket({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      instanceName: body.evolutionInstanceName,
    });

    if (!websocketSetup.ok) {
      app.log.error({
        action: 'configure_websocket',
        instanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        status: websocketSetup.status,
        payload: websocketSetup.payload,
      }, 'Falha ao configurar websocket da Evolution na criacao da instancia.');

      return reply.code(400).send({
        message: 'Falha ao configurar o websocket da Evolution para esta instancia.',
        status: websocketSetup.status,
        payload: websocketSetup.payload,
      });
    }

    const item = await app.prisma.whatsAppInstance.create({
      data: {
        id: randomUUID(),
        name: body.name,
        evolutionInstanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        apiKeyEncrypted: encryptSecret(body.apiKey, env.SESSION_SECRET),
        webhookSecret: body.webhookSecret,
        status: 'disconnected',
      },
      select: {
        id: true,
        name: true,
        evolutionInstanceName: true,
        baseUrl: true,
        status: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await app.evolutionSockets.refreshAll();
    app.io.emit('instance.updated', { instanceId: item.id, status: item.status });

    return reply.code(201).send({ item });
  });

  app.put('/whatsapp/instances/:instanceId', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'channels.manage'))) return;

    const params = z.object({ instanceId: z.string().uuid() }).parse(request.params);
    const body = updateInstanceSchema.parse(request.body);

    const existing = await app.prisma.whatsAppInstance.findUnique({
      where: { id: params.instanceId },
      select: { id: true, apiKeyEncrypted: true },
    });

    if (!existing) {
      return reply.notFound('Instancia nao encontrada.');
    }

    const apiKey = body.apiKey && body.apiKey.trim().length > 0
      ? body.apiKey
      : decryptSecret(existing.apiKeyEncrypted, env.SESSION_SECRET);

    const websocketSetup = await configureEvolutionWebSocket({
      baseUrl: body.baseUrl,
      apiKey,
      instanceName: body.evolutionInstanceName,
    });

    if (!websocketSetup.ok) {
      app.log.error({
        action: 'configure_websocket',
        instanceId: params.instanceId,
        instanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        status: websocketSetup.status,
        payload: websocketSetup.payload,
      }, 'Falha ao atualizar websocket da Evolution.');

      return reply.code(400).send({
        message: 'Falha ao atualizar o websocket da Evolution para esta instancia.',
        status: websocketSetup.status,
        payload: websocketSetup.payload,
      });
    }

    const item = await app.prisma.whatsAppInstance.update({
      where: { id: params.instanceId },
      data: {
        name: body.name,
        evolutionInstanceName: body.evolutionInstanceName,
        baseUrl: body.baseUrl,
        ...(body.apiKey && body.apiKey.trim().length > 0 ? { apiKeyEncrypted: encryptSecret(body.apiKey, env.SESSION_SECRET) } : {}),
        webhookSecret: body.webhookSecret || null,
      },
      select: {
        id: true,
        name: true,
        evolutionInstanceName: true,
        baseUrl: true,
        status: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await app.evolutionSockets.refreshAll();
    app.io.emit('instance.updated', { instanceId: item.id, status: item.status, action: 'updated' });

    return reply.code(200).send({
      message: 'Instancia atualizada com sucesso.',
      item,
    });
  });
};
