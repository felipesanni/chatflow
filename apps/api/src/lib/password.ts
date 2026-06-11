import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');

  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  const target = Buffer.from(hash, 'hex');

  if (derived.length !== target.length) {
    return false;
  }

  return timingSafeEqual(derived, target);
}
