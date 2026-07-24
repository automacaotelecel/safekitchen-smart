import 'express-async-errors';

import cors, { type CorsOptions } from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { env } from './config/env';
import { prisma } from './lib/prisma';

import accountRoutes from './modules/account/account.routes';
import authRoutes from './modules/auth/auth.routes';
import billingRoutes from './modules/billing/billing.routes';
import complianceRoutes from './modules/compliance/compliance.routes';
import documentRoutes from './modules/documents/documents.routes';
import employeeRoutes from './modules/employees/employees.routes';
import labelRoutes from './modules/labels/labels.routes';
import notificationRoutes, { alertJobHandler } from './modules/notifications/notifications.routes';
import { runAlertCycle } from './modules/notifications/notifications.service';
import productRoutes from './modules/products/products.routes';
import reportRoutes from './modules/reports/reports.routes';
import temperatureRoutes from './modules/temperature/temperature.routes';
import validityRoutes from './modules/validity/validity.routes';
import visionRoutes from './modules/vision/vision.routes';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, '');
}

const frontendUrlsFromEnv = env.frontendUrl
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...(!env.isProduction
    ? [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
      ]
    : []),
  'https://safekitchen.vercel.app',
  'https://safekitchensmart.com.br',
  'https://www.safekitchensmart.com.br',
  ...frontendUrlsFromEnv,
]
  .map(normalizeOrigin)
  .filter((origin, index, array) => origin && array.indexOf(origin) === index);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);

    return callback(new Error('Origem não permitida pelo CORS.'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Device-Key',
    'X-Operations-Secret',
  ],
  optionsSuccessStatus: 204,
};

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Muitas requisições. Aguarde alguns minutos e tente novamente.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    ok: false,
    message: 'Muitas tentativas de acesso. Aguarde alguns minutos.',
  },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use(express.json({ limit: '9mb' }));

app.get('/health', async (_req, res) => {
  let database = 'unavailable';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'ok';
  } catch {
    database = 'unavailable';
  }

  const ok = database === 'ok';

  return res.status(ok ? 200 : 503).json({
    ok,
    app: 'SafeKitchen Smart API',
    database,
    visionEnabled: Boolean(env.geminiApiKey),
    storageEnabled: env.storageEnabled,
    billingEnabled: env.mercadoPagoEnabled,
    emailEnabled: env.emailEnabled,
    contractEnabled: env.contractProviderConfigured,
    billingOperationsEnabled: env.billingOperationsEnabled,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.post('/api/jobs/alerts', alertJobHandler);
app.use('/api/account', accountRoutes);
app.use('/api/products', productRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/validity-rules', validityRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/temperature', temperatureRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Rota não encontrada.',
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);

  const message =
    error instanceof Error && !env.isProduction
      ? error.message
      : 'Erro interno do servidor.';

  res.status(500).json({
    ok: false,
    message,
  });
});

const server = app.listen(env.port, () => {
  console.log(`SafeKitchen Smart API disponível na porta ${env.port}.`);
});

let alertCycleRunning = false;
async function scheduledAlertCycle() {
  if (alertCycleRunning) return;
  alertCycleRunning = true;
  try {
    await runAlertCycle();
  } catch (error) {
    console.error('Falha no ciclo agendado de alertas:', error);
  } finally {
    alertCycleRunning = false;
  }
}

if (env.nodeEnv !== 'test') {
  setTimeout(() => void scheduledAlertCycle(), 15_000).unref();
  setInterval(
    () => void scheduledAlertCycle(),
    env.alertIntervalMinutes * 60_000
  ).unref();
}

async function shutdown(signal: string) {
  console.log(`Encerrando servidor (${signal})...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
