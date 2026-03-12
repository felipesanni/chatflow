import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

export const realtimePlugin = fp(async (app: FastifyInstance) => {
  app.io.on('connection', (socket) => {
    app.log.debug({ socketId: socket.id }, 'Socket client connected');

    socket.on('disconnect', () => {
      app.log.debug({ socketId: socket.id }, 'Socket client disconnected');
    });
  });
});
