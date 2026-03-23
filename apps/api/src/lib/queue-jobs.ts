export const EVOLUTION_EVENT_QUEUE = 'evolution-events';
export const SCHEDULED_MESSAGE_QUEUE = 'scheduled-messages';

export interface EvolutionEventJobPayload {
  source: string;
  payload: Record<string, unknown>;
  event?: string | null;
  instanceName?: string | null;
  incomingSecret?: string | null;
  validateSecret?: boolean;
}

export interface ScheduledMessageJobPayload {
  scheduledMessageId: string;
}
