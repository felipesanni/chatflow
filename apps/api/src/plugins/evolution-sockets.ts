import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { io, type Socket } from 'socket.io-client';
import { decryptSecret } from '../lib/secrets.js';
import { loadEnv } from '../config/env.js';
import { configureEvolutionWebSocket } from '../lib/evolution-client.js';
import { processEvolutionEvent } from '../lib/evolution-events.js';

interface EvolutionSocketManager {
  refreshAll: () => Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    evolutionSockets: EvolutionSocketManager;
  }
}

const SOCKET_EVENTS = [
  'messages.upsert',
  'messages.update',
  'connection.update',
  'qrcode.updated',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'CONNECTION_UPDATE',
  'QRCODE_UPDATED',
] as const;

export const evolutionSocketsPlugin = fp(async (app: FastifyInstance) => {
  const env = loadEnv();
  const sockets = new Map<string, Socket>();

  async function disconnectAll() {
    for (const socket of sockets.values()) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    sockets.clear();
  }

  async function refreshAll() {
    await disconnectAll();

    const instances = await app.prisma.whatsAppInstance.findMany({
      select: {
        id: true,
        evolutionInstanceName: true,
        baseUrl: true,
        apiKeyEncrypted: true,
      },
    });

    const groups = new Map<string, { baseUrl: string; apiKey: string; instanceNames: string[] }>();

    for (const instance of instances) {
      const apiKey = decryptSecret(instance.apiKeyEncrypted, env.SESSION_SECRET);

      try {
        const websocketSetup = await configureEvolutionWebSocket({
          baseUrl: instance.baseUrl,
          apiKey,
          instanceName: instance.evolutionInstanceName,
        });

        if (!websocketSetup.ok) {
          app.log.error({
            action: 'configure_websocket',
            instanceId: instance.id,
            instanceName: instance.evolutionInstanceName,
            baseUrl: instance.baseUrl,
            status: websocketSetup.status,
            payload: websocketSetup.payload,
          }, 'Falha ao configurar websocket da Evolution.');
        }
      } catch (error) {
        app.log.error({
          action: 'configure_websocket',
          instanceId: instance.id,
          instanceName: instance.evolutionInstanceName,
          baseUrl: instance.baseUrl,
          error,
        }, 'Erro ao configurar websocket da Evolution.');
      }

      const groupKey = `${instance.baseUrl}::${apiKey}`;
      const existing = groups.get(groupKey);

      if (existing) {
        existing.instanceNames.push(instance.evolutionInstanceName);
      } else {
        groups.set(groupKey, {
          baseUrl: instance.baseUrl,
          apiKey,
          instanceNames: [instance.evolutionInstanceName],
        });
      }
    }

    for (const [groupKey, group] of groups.entries()) {
      const socket = io(group.baseUrl.replace(/\/$/, ''), {
        transports: ['websocket'],
        reconnection: true,
        timeout: 20000,
        extraHeaders: {
          apikey: group.apiKey,
        },
        auth: {
          apikey: group.apiKey,
        },
        query: {
          apikey: group.apiKey,
        },
      });

      socket.on('connect', () => {
        app.log.info({
          action: 'evolution_socket_connected',
          baseUrl: group.baseUrl,
          instances: group.instanceNames,
          socketId: socket.id,
        }, 'Socket da Evolution conectado.');
      });

      socket.on('connect_error', (error) => {
        app.log.error({
          action: 'evolution_socket_connect_error',
          baseUrl: group.baseUrl,
          instances: group.instanceNames,
          message: error.message,
        }, 'Falha ao conectar socket da Evolution.');
      });

      socket.on('disconnect', (reason) => {
        app.log.warn({
          action: 'evolution_socket_disconnected',
          baseUrl: group.baseUrl,
          instances: group.instanceNames,
          reason,
        }, 'Socket da Evolution desconectado.');
      });

      for (const eventName of SOCKET_EVENTS) {
        socket.on(eventName, async (payload: Record<string, unknown>) => {
          try {
            await processEvolutionEvent(app, {
              source: 'evolution_ws',
              event: eventName,
              payload,
            });
          } catch (error) {
            app.log.error({
              action: 'process_evolution_socket_event',
              event: eventName,
              baseUrl: group.baseUrl,
              error,
            }, 'Falha ao processar evento recebido da Evolution via websocket.');
          }
        });
      }

      sockets.set(groupKey, socket);
    }
  }

  app.decorate('evolutionSockets', {
    refreshAll,
  });

  await refreshAll();

  app.addHook('onClose', async () => {
    await disconnectAll();
  });
});
