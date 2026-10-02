import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DUSK_TTL_SECONDS: z.coerce.number().default(86400),
  VIEWER_LIST_RETENTION: z.coerce.number().default(172800),
  UNDO_WINDOW: z.coerce.number().default(2592000),
  DATABASE_URL: z.string().default('postgres://dusk:dusk@localhost:5432/dusk'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MINIO_ENDPOINT: z.string().default('http://localhost:9000'),
  APP_MODE: z.string().default('demo'),
  ROLE: z.string().default('api')
});

export const config = envSchema.parse(process.env);
