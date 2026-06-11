import 'dotenv/config';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

async function start() {
  const env = loadEnv();
  const app = await buildApp();

  try {
    await app.listen({
      host: env.API_HOST,
      port: env.API_PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
