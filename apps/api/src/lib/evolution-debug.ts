import { randomUUID } from 'node:crypto';
import { parseEvolutionPayload } from './evolution.js';

export interface EvolutionDebugEntry {
  id: string;
  recordedAt: string;
  stage: 'received';
  source: 'webhook' | 'socket';
  event: string;
  instanceName: string | null;
  baseUrl: string | null;
  socketUrl: string | null;
  remoteJid: string | null;
  isGroup: boolean;
  groupName: string | null;
  pushName: string | null;
  verifiedBizName: string | null;
  bodyPreview: string | null;
  contentType: string | null;
  payloadSummary: {
    topLevelKeys: string[];
    dataKeys: string[];
    firstDataItemKeys: string[];
    hasDataArray: boolean;
    dataLength: number | null;
  };
}

export interface EvolutionDebugMonitor {
  push: (entry: EvolutionDebugEntry) => void;
  list: (limit?: number) => EvolutionDebugEntry[];
  clear: () => void;
}

const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;

function summarizePayloadShape(payload: Record<string, unknown>) {
  const topLevelKeys = Object.keys(payload).slice(0, 20);
  const data = payload.data;
  const dataKeys = data && typeof data === 'object' && !Array.isArray(data)
    ? Object.keys(data).slice(0, 20)
    : [];
  const firstDataItem = Array.isArray(data) && data[0] && typeof data[0] === 'object'
    ? data[0]
    : null;
  const firstDataItemKeys = firstDataItem
    ? Object.keys(firstDataItem as Record<string, unknown>).slice(0, 20)
    : [];

  return {
    topLevelKeys,
    dataKeys,
    firstDataItemKeys,
    hasDataArray: Array.isArray(data),
    dataLength: Array.isArray(data) ? data.length : null,
  };
}

export function createEvolutionDebugMonitor(maxEntries = 200): EvolutionDebugMonitor {
  const entries: EvolutionDebugEntry[] = [];

  function purgeExpiredEntries() {
    const cutoff = Date.now() - SIX_HOURS_IN_MS;
    const activeEntries = entries.filter((entry) => {
      const recordedAt = Date.parse(entry.recordedAt);
      return Number.isFinite(recordedAt) && recordedAt >= cutoff;
    });

    entries.length = 0;
    entries.push(...activeEntries);
  }

  return {
    push(entry) {
      purgeExpiredEntries();
      entries.unshift(entry);
      if (entries.length > maxEntries) {
        entries.length = maxEntries;
      }
    },
    list(limit = 50) {
      purgeExpiredEntries();
      return entries.slice(0, Math.max(1, Math.min(limit, maxEntries)));
    },
    clear() {
      entries.length = 0;
    },
  };
}

export function buildEvolutionDebugEntry(params: {
  source: 'webhook' | 'socket';
  event: string;
  payload: Record<string, unknown>;
  instanceName?: string | null;
  baseUrl?: string | null;
  socketUrl?: string | null;
}): EvolutionDebugEntry {
  const parsed = parseEvolutionPayload(params.payload, {
    event: params.event,
    instanceName: params.instanceName ?? undefined,
  });
  const bodyPreview = typeof parsed.body === 'string' && parsed.body.trim().length > 0
    ? parsed.body.trim().slice(0, 280)
    : null;

  return {
    id: randomUUID(),
    recordedAt: new Date().toISOString(),
    stage: 'received',
    source: params.source,
    event: params.event,
    instanceName: parsed.instanceName ?? params.instanceName ?? null,
    baseUrl: params.baseUrl ?? null,
    socketUrl: params.socketUrl ?? null,
    remoteJid: parsed.remoteJid,
    isGroup: parsed.isGroup,
    groupName: parsed.groupName,
    pushName: parsed.pushName,
    verifiedBizName: parsed.verifiedBizName,
    bodyPreview,
    contentType: parsed.contentType ?? null,
    payloadSummary: summarizePayloadShape(params.payload),
  };
}
