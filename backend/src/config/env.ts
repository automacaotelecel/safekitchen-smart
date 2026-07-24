import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres.'),
  FRONTEND_URL: z.string().default('http://localhost:5174'),
  BACKEND_URL: z.string().default('http://localhost:3333'),
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
  MERCADO_PAGO_ACCESS_TOKEN: z.string().default(''),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().default(''),
  PLAN_START_SETUP_PRICE: z.coerce.number().positive().default(590),
  PLAN_START_MONTHLY_PRICE: z.coerce.number().positive().default(197),
  PLAN_PRO_SETUP_PRICE: z.coerce.number().positive().default(1490),
  PLAN_PRO_MONTHLY_PRICE: z.coerce.number().positive().default(397),
  CONTRACT_PROVIDER_NAME: z.string().default(''),
  CONTRACT_PROVIDER_DOCUMENT: z.string().default(''),
  CONTRACT_PROVIDER_ADDRESS: z.string().default(''),
  CONTRACT_PROVIDER_EMAIL: z.string().email().or(z.literal('')).default(''),
  CONTRACT_CITY: z.string().default(''),
  CONTRACT_TERMS_VERSION: z.string().default('2026-07-25'),
  CONTRACT_IMPLEMENTATION_DAYS: z.coerce.number().int().min(1).max(180).default(15),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('SafeKitchen Smart <alertas@safekitchensmart.com.br>'),
  EMAIL_REPLY_TO: z.string().email().or(z.literal('')).default(''),
  BILLING_OPERATIONS_SECRET: z
    .string()
    .default('')
    .refine((value) => !value || value.length >= 32, {
      message: 'BILLING_OPERATIONS_SECRET deve ter pelo menos 32 caracteres.',
    }),
  ALERT_JOB_SECRET: z.string().default(''),
  ALERT_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  DEVICE_OFFLINE_MINUTES: z.coerce.number().int().min(5).max(10080).default(60),
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
  backendUrl: parsed.data.BACKEND_URL.replace(/\/$/, ''),
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
  mercadoPagoAccessToken: parsed.data.MERCADO_PAGO_ACCESS_TOKEN,
  mercadoPagoWebhookSecret: parsed.data.MERCADO_PAGO_WEBHOOK_SECRET,
  mercadoPagoEnabled: Boolean(parsed.data.MERCADO_PAGO_ACCESS_TOKEN),
  planStartSetupPrice: parsed.data.PLAN_START_SETUP_PRICE,
  planStartMonthlyPrice: parsed.data.PLAN_START_MONTHLY_PRICE,
  planProSetupPrice: parsed.data.PLAN_PRO_SETUP_PRICE,
  planProMonthlyPrice: parsed.data.PLAN_PRO_MONTHLY_PRICE,
  contractProviderName: parsed.data.CONTRACT_PROVIDER_NAME,
  contractProviderDocument: parsed.data.CONTRACT_PROVIDER_DOCUMENT,
  contractProviderAddress: parsed.data.CONTRACT_PROVIDER_ADDRESS,
  contractProviderEmail: parsed.data.CONTRACT_PROVIDER_EMAIL,
  contractCity: parsed.data.CONTRACT_CITY,
  contractTermsVersion: parsed.data.CONTRACT_TERMS_VERSION,
  contractImplementationDays: parsed.data.CONTRACT_IMPLEMENTATION_DAYS,
  contractProviderConfigured: Boolean(
    parsed.data.CONTRACT_PROVIDER_NAME &&
      parsed.data.CONTRACT_PROVIDER_DOCUMENT &&
      parsed.data.CONTRACT_PROVIDER_ADDRESS &&
      parsed.data.CONTRACT_PROVIDER_EMAIL &&
      parsed.data.CONTRACT_CITY
  ),
  resendApiKey: parsed.data.RESEND_API_KEY,
  emailFrom: parsed.data.EMAIL_FROM,
  emailReplyTo: parsed.data.EMAIL_REPLY_TO,
  emailEnabled: Boolean(parsed.data.RESEND_API_KEY),
  billingOperationsSecret: parsed.data.BILLING_OPERATIONS_SECRET,
  billingOperationsEnabled: Boolean(parsed.data.BILLING_OPERATIONS_SECRET),
  alertJobSecret: parsed.data.ALERT_JOB_SECRET,
  alertIntervalMinutes: parsed.data.ALERT_INTERVAL_MINUTES,
  deviceOfflineMinutes: parsed.data.DEVICE_OFFLINE_MINUTES,
};
