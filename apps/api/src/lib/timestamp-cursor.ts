import { Buffer } from 'node:buffer';
import { z } from 'zod';

const timestampCursorPayloadSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export type TimestampCursor = {
  id: string;
  timestamp: Date;
};

export function encodeTimestampCursor(item: { id: string; timestamp: Date }) {
  return Buffer.from(JSON.stringify({
    id: item.id,
    timestamp: item.timestamp.toISOString(),
  })).toString('base64url');
}

export function decodeTimestampCursor(value: string): TimestampCursor | null {
  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const parsed = timestampCursorPayloadSchema.parse(payload);
    const timestamp = new Date(parsed.timestamp);

    if (Number.isNaN(timestamp.getTime())) {
      return null;
    }

    return {
      id: parsed.id,
      timestamp,
    };
  } catch {
    return null;
  }
}
