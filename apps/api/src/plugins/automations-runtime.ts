import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { runAutomationMaintenance } from '../lib/automations-engine.js';

const AUTOMATION_RUNTIME_INTERVAL_MS = 60_000;
const AUTOMATION_RUNTIME_START_DELAY_MS = 15_000;

export const automationsRuntimePlugin = fp(async (app: FastifyInstance) => {
  const runMaintenance = async () => {
    try {
      await runAutomationMaintenance(app);
    } catch (error) {
      app.log.error({ action: 'automation_runtime_maintenance_failed', error }, 'Falha ao executar manutencao das automacoes.');
    }
  };

  const startupTimer = setTimeout(() => {
    void runMaintenance();
  }, AUTOMATION_RUNTIME_START_DELAY_MS);

  const interval = setInterval(() => {
    void runMaintenance();
  }, AUTOMATION_RUNTIME_INTERVAL_MS);

  app.addHook('onClose', async () => {
    clearTimeout(startupTimer);
    clearInterval(interval);
  });
});
