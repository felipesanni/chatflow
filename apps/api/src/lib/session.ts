import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildCookieOptions } from './cookies.js';

const SESSION_COOKIE = 'chatflow_session';

export interface SessionPayload {
  userId: string;
  role: 'admin' | 'agent';
  email: string;
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(session: SessionPayload, secret: string): string {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function readSessionToken(token: string, secret: string): SessionPayload | null {
  const [payload, signature] = token.split('.');

  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(payload)) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string, isProduction: boolean) {
  reply.setCookie(SESSION_COOKIE, token, {
    ...buildCookieOptions(isProduction),
    maxAge: 60 * 60 * 12,
  });
}

export function clearSessionCookie(reply: FastifyReply, isProduction: boolean) {
  reply.clearCookie(SESSION_COOKIE, buildCookieOptions(isProduction));
}

export function getSessionFromRequest(request: FastifyRequest, secret: string): SessionPayload | null {
  const token = request.cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  return readSessionToken(token, secret);
}
