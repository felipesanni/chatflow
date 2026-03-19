export const EVOLUTION_EVENT_QUEUE = 'evolution-events';

export interface EvolutionEventJobPayload {
  source: string;
  payload: Record<string, unknown>;
  event?: string | null;
  instanceName?: string | null;
  incomingSecret?: string | null;
  validateSecret?: boolean;
}

