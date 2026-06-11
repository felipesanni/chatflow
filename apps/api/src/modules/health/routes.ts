import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    const startedAt = new Date().toISOString();

    try {
      await app.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        servico: 'chatflow-api',
        banco: 'conectado',
        dataHora: startedAt,
      };
    } catch {
      return reply.code(503).send({
        status: 'degradado',
        servico: 'chatflow-api',
        banco: 'desconectado',
        dataHora: startedAt,
      });
    }
  });
};
