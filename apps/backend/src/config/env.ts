import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().default('fynly_default_dev_jwt_secret_key_12345'),
  JWT_REFRESH_SECRET: z.string().default('fynly_default_dev_jwt_refresh_secret_key_12345'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('90d'),
  CLIENT_ORIGIN: z.string().default('*'),
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().optional().default('Fynly'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
