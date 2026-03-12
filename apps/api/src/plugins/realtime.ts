import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

export const realtimePlugin = fp(async (app: FastifyInstance, options: { corsOrigin: string }) => {
  const io = new Server(app.server, {
    cors: {
      origin: [options.corsOrigin],
      credentials: true,
    },
  });

  app.decorate('io', io);

  io.on('connection', (socket) => {
    app.log.debug({ socketId: socket.id }, 'Socket client connected');

    socket.on('disconnect', () => {
      app.log.debug({ socketId: socket.id }, 'Socket client disconnected');
    });
  });

  app.addHook('onClose', async () => {
    await io.close();
  });
});
