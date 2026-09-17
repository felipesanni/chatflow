import type { FastifyInstance } from 'fastify';

export const AUTOMATION_EXECUTION_RETENTION_DAYS = 7;

const AUTOMATION_EXECUTION_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const AUTOMATION_EXECUTION_RETENTION_BATCH_SIZE = 5_000;

let lastAutomaticRetentionRunAt = 0;
let retentionRunPromise: Promise<AutomationRetentionResult> | null = null;

export type AutomationRetentionResult = {
  deleted: number;
  deletedWebhookLogs: number;
  remaining: number | null;
  cutoff: Date;
  skipped: boolean;
};

/**
 * Removes automation execution history and legacy webhook payload logs older
 * than the retention window. Ticket messages and tickets are never touched.
 * The durable dedupe table is populated before execution rows are removed so
 * retention cannot make an automation run twice for the same context.
 */
export function cleanupOldAutomationExecutions(
  app: FastifyInstance,
  options: { force?: boolean; now?: Date } = {},
): Promise<AutomationRetentionResult> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - AUTOMATION_EXECUTION_RETENTION_DAYS * 24 * 60 * 60 * 1_000);

  if (retentionRunPromise) {
    return retentionRunPromise;
  }

  if (!options.force && now.getTime() - lastAutomaticRetentionRunAt < AUTOMATION_EXECUTION_RETENTION_INTERVAL_MS) {
    return Promise.resolve({
      deleted: 0,
      deletedWebhookLogs: 0,
      remaining: null,
      cutoff,
      skipped: true,
    });
  }

  retentionRunPromise = (async () => {
    let deleted = 0;
    let deletedWebhookLogs = 0;

    for (;;) {
      await app.prisma.$executeRaw`
        WITH batch AS (
          SELECT id, automation_id, dedupe_key, trigger_payload, status, executed_at
          FROM automation_executions
          WHERE executed_at < ${cutoff}
            AND dedupe_key IS NOT NULL
          ORDER BY executed_at ASC, id ASC
          LIMIT ${AUTOMATION_EXECUTION_RETENTION_BATCH_SIZE}
        )
        INSERT INTO automation_execution_dedupes (
          id,
          automation_id,
          ticket_id,
          trigger_type,
          dedupe_key,
          claimed_at,
          completed_at
        )
        SELECT
          batch.id,
          batch.automation_id,
          ticket.id,
          CASE batch.trigger_payload->>'triggerType'
            WHEN 'message_received' THEN 'message_received'::"AutomationTriggerType"
            WHEN 'ticket_created' THEN 'ticket_created'::"AutomationTriggerType"
            WHEN 'ticket_inactive' THEN 'ticket_inactive'::"AutomationTriggerType"
            WHEN 'scheduled_time' THEN 'scheduled_time'::"AutomationTriggerType"
          END,
          batch.dedupe_key,
          batch.executed_at,
          CASE
            WHEN batch.status IN ('success', 'failed') THEN batch.executed_at
            ELSE NULL
          END
        FROM batch
        JOIN tickets AS ticket
          ON ticket.id::text = batch.trigger_payload->>'ticketId'
        WHERE batch.trigger_payload->>'triggerType' IN (
          'message_received',
          'ticket_created',
          'ticket_inactive',
          'scheduled_time'
        )
        ON CONFLICT (automation_id, dedupe_key) DO NOTHING
      `;

      const batchDeleted = Number(await app.prisma.$executeRaw`
        WITH batch AS (
          SELECT id
          FROM automation_executions
          WHERE executed_at < ${cutoff}
          ORDER BY executed_at ASC, id ASC
          LIMIT ${AUTOMATION_EXECUTION_RETENTION_BATCH_SIZE}
        )
        DELETE FROM automation_executions AS execution
        USING batch
        WHERE execution.id = batch.id
      `);

      deleted += batchDeleted;

      if (batchDeleted < AUTOMATION_EXECUTION_RETENTION_BATCH_SIZE) {
        break;
      }
    }

    for (;;) {
      const batchDeleted = Number(await app.prisma.$executeRaw`
        WITH batch AS (
          SELECT id
          FROM webhook_logs
          WHERE received_at < ${cutoff}
          ORDER BY received_at ASC, id ASC
          LIMIT ${AUTOMATION_EXECUTION_RETENTION_BATCH_SIZE}
        )
        DELETE FROM webhook_logs AS log
        USING batch
        WHERE log.id = batch.id
      `);

      deletedWebhookLogs += batchDeleted;

      if (batchDeleted < AUTOMATION_EXECUTION_RETENTION_BATCH_SIZE) {
        break;
      }
    }

    const remaining = await app.prisma.automationExecution.count({
      where: {
        executedAt: { lt: cutoff },
      },
    });

    lastAutomaticRetentionRunAt = now.getTime();

    if (deleted > 0 || deletedWebhookLogs > 0) {
      app.log.info({
        action: 'automation_execution_retention_cleanup',
        deleted,
        deletedWebhookLogs,
        remaining,
        retentionDays: AUTOMATION_EXECUTION_RETENTION_DAYS,
        cutoff: cutoff.toISOString(),
      }, 'Histórico antigo de automações removido.');
    }

    return {
      deleted,
      deletedWebhookLogs,
      remaining,
      cutoff,
      skipped: false,
    };
  })().finally(() => {
    retentionRunPromise = null;
  });

  return retentionRunPromise;
}
