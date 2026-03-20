import { z } from 'zod';

const DISALLOWED_PRODUCTION_SECRETS = new Set([
  'change-me',
  'change-this-in-production',
  'change-this-password',
]);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  API_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PUBLIC_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  QUEUE_WEBHOOK_CONCURRENCY: z.coerce.number().int().positive().default(4),
  SESSION_SECRET: z.string().min(8),
  WEB_APP_URL: z.string().url(),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
  ADMIN_BOOTSTRAP_NAME: z.string().min(2).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid API environment: ${issues}`);
  }

  if (parsed.data.NODE_ENV === 'production') {
    if (DISALLOWED_PRODUCTION_SECRETS.has(parsed.data.SESSION_SECRET)) {
      throw new Error('Invalid API environment: SESSION_SECRET must be replaced before running in production.');
    }

    if (
      parsed.data.ADMIN_BOOTSTRAP_PASSWORD
      && DISALLOWED_PRODUCTION_SECRETS.has(parsed.data.ADMIN_BOOTSTRAP_PASSWORD)
    ) {
      throw new Error('Invalid API environment: ADMIN_BOOTSTRAP_PASSWORD must be replaced or removed before running in production.');
    }
  }

  return parsed.data;
}
