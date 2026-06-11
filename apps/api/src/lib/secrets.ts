import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function deriveKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string, secret: string): string {
  const iv = randomBytes(12);
  const key = deriveKey(secret);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string, secret: string): string {
  if (!value.startsWith('enc:')) {
    return value;
  }

  const [, ivRaw, authTagRaw, payloadRaw] = value.split(':');
  if (!ivRaw || !authTagRaw || !payloadRaw) {
    throw new Error('Stored secret has invalid format.');
  }

  const key = deriveKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadRaw, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
