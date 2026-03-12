import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    const startedAt = new Date().toISOString();

    try {
      await app.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        service: 'chatflow-api',
        database: 'connected',
        timestamp: startedAt,
      };
    } catch {
      return {
        status: 'degraded',
        service: 'chatflow-api',
        database: 'disconnected',
        timestamp: startedAt,
      };
    }
  });
};
