import type { FastifyInstance } from 'fastify';

export const AUTOMATION_EXECUTION_RETENTION_DAYS = 7;

const AUTOMATION_EXECUTION_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const AUTOMATION_EXECUTION_RETENTION_BATCH_SIZE = 5_000;

let lastAutomaticRetentionRunAt = 0;
let retentionRunPromise: Promise<AutomationRetentionResult> | null = null;

export type AutomationRetentionResult = {
  deleted: number;
  remaining: number | null;
  cutoff: Date;
  skipped: boolean;
};

/**
 * Removes only skipped automation executions older than the retention window.
 * Ticket messages and successful/failed executions are intentionally preserved.
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
      remaining: null,
      cutoff,
      skipped: true,
    });
  }

  retentionRunPromise = (async () => {
    let deleted = 0;

    for (;;) {
      const batchDeleted = Number(await app.prisma.$executeRaw`
        WITH batch AS (
          SELECT id
          FROM automation_executions
          WHERE status = 'skipped'
            AND executed_at < ${cutoff}
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

    const remaining = await app.prisma.automationExecution.count({
      where: {
        status: 'skipped',
        executedAt: { lt: cutoff },
      },
    });

    lastAutomaticRetentionRunAt = now.getTime();

    if (deleted > 0) {
      app.log.info({
        action: 'automation_execution_retention_cleanup',
        deleted,
        remaining,
        retentionDays: AUTOMATION_EXECUTION_RETENTION_DAYS,
        cutoff: cutoff.toISOString(),
      }, 'Histórico antigo de automações removido.');
    }

    return {
      deleted,
      remaining,
      cutoff,
      skipped: false,
    };
  })().finally(() => {
    retentionRunPromise = null;
  });

  return retentionRunPromise;
}
