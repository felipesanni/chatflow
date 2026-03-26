import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_PREFIX = 'cf_live_';

export function createApiAccessTokenValue() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
}

export function hashApiAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function buildApiAccessTokenPrefix(token: string) {
  return token.slice(0, Math.min(token.length, 18));
}

export function parseBearerToken(headerValue: string | undefined) {
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1]?.trim();
  return token ? token : null;
}

export function compareTokenHashes(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
