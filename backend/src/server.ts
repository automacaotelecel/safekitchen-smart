import express from 'express';
import cors from 'cors';

import { env } from './config/env';

import authRoutes from './modules/auth/auth.routes';
import productRoutes from './modules/products/products.routes';
import labelRoutes from './modules/labels/labels.routes';
import employeeRoutes from './modules/employees/employees.routes';
import validityRoutes from './modules/validity/validity.routes';
import visionRoutes from './modules/vision/vision.routes';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  env.frontendUrl,
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '12mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'SafeKitchen Smart API',
    port: env.port,
    cors: allowedOrigins,
    visionEnabled: Boolean(env.geminiApiKey),
    geminiModel: env.geminiModel,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/validity-rules', validityRoutes);
app.use('/api/vision', visionRoutes);

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Rota não encontrada.',
  });
});

app.listen(env.port, () => {
  console.log(`SafeKitchen Smart API rodando em http://localhost:${env.port}`);
  console.log('CORS liberado para:');
  allowedOrigins.forEach((origin) => console.log(`- ${origin}`));
  console.log(`IA Gemini: ${env.geminiApiKey ? 'configurada' : 'não configurada'}`);
  console.log(`Modelo Gemini: ${env.geminiModel}`);
});