import type { FastifyReply, FastifyRequest } from 'fastify';
import { loadEnv } from '../config/env.js';
import { getSessionFromRequest } from './session.js';

const env = loadEnv();

export function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const session = getSessionFromRequest(request, env.SESSION_SECRET);

  if (!session) {
    reply.unauthorized('Authentication required.');
    return null;
  }

  return session;
}
