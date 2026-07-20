import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres.'),
  FRONTEND_URL: z.string().default('http://localhost:5174'),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_FALLBACK_MODELS: z.string().default('gemini-2.5-flash-lite'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(45000),
  MAX_IMAGE_BYTES: z.coerce.number().int().min(100000).max(15000000).default(6000000),
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  MAX_DOCUMENT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(20 * 1024 * 1024),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => issue.message).join(' ');
  throw new Error(`Configuração inválida: ${messages}`);
}

if (
  parsed.data.NODE_ENV === 'production' &&
  (parsed.data.JWT_SECRET.length < 32 || parsed.data.JWT_SECRET.includes('troque'))
) {
  throw new Error('Em produção, JWT_SECRET deve ser aleatória e ter no mínimo 32 caracteres.');
}

const storageEnabled = Boolean(
  parsed.data.S3_BUCKET &&
    parsed.data.S3_ACCESS_KEY_ID &&
    parsed.data.S3_SECRET_ACCESS_KEY
);

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  frontendUrl: parsed.data.FRONTEND_URL,
  geminiApiKey: parsed.data.GEMINI_API_KEY,
  geminiModel: parsed.data.GEMINI_MODEL,
  geminiFallbackModels: parsed.data.GEMINI_FALLBACK_MODELS
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
  aiTimeoutMs: parsed.data.AI_TIMEOUT_MS,
  maxImageBytes: parsed.data.MAX_IMAGE_BYTES,
  s3Endpoint: parsed.data.S3_ENDPOINT,
  s3Region: parsed.data.S3_REGION,
  s3Bucket: parsed.data.S3_BUCKET,
  s3AccessKeyId: parsed.data.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: parsed.data.S3_FORCE_PATH_STYLE,
  maxDocumentBytes: parsed.data.MAX_DOCUMENT_BYTES,
  storageEnabled,
};

