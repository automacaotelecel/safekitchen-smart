import { randomUUID } from 'crypto';

import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import {
  createDocumentDownloadUrl,
  createDocumentUploadUrl,
} from '../../lib/storage';
import { authMiddleware } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

const documentSchema = z.object({
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(80),
  fileName: z.string().trim().max(220).optional().nullable(),
  mimeType: z.string().trim().max(120).optional().nullable(),
  sizeBytes: z.number().int().min(0).max(100 * 1024 * 1024).optional().nullable(),
  storageKey: z.string().trim().max(500).optional().nullable(),
  externalUrl: z.string().url().max(1000).optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  reminderDays: z.number().int().min(0).max(365).default(30),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(220),
  mimeType: z.string().trim().min(3).max(120),
  sizeBytes: z.number().int().positive(),
});

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'documento';
}

router.get('/storage', (_req, res) => {
  return ok(res, {
    enabled: env.storageEnabled,
    maxDocumentBytes: env.maxDocumentBytes,
  });
});

router.get('/summary', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const now = new Date();
  const dueUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const base = {
    restaurantId: req.user.restaurantId,
    status: 'ACTIVE',
  };

  const [total, expired, expiringSoon, recent] = await Promise.all([
    prisma.document.count({ where: base }),
    prisma.document.count({
      where: {
        ...base,
        expiresAt: { lt: now },
      },
    }),
    prisma.document.count({
      where: {
        ...base,
        expiresAt: {
          gte: now,
          lte: dueUntil,
        },
      },
    }),
    prisma.document.findMany({
      where: base,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return ok(res, { total, expired, expiringSoon, recent });
});

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const documents = await prisma.document.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      ...(String(req.query.includeArchived || '') === '1'
        ? {}
        : { status: 'ACTIVE' }),
      ...(req.query.category
        ? { category: String(req.query.category) }
        : {}),
    },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  });

  return ok(res, documents);
});

router.post('/upload-url', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  if (!env.storageEnabled) {
    return fail(res, 'Armazenamento de arquivos ainda não configurado.', 503);
  }

  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Arquivo inválido.', 422, parsed.error.flatten());
  if (parsed.data.sizeBytes > env.maxDocumentBytes) {
    return fail(
      res,
      `Arquivo maior que o limite de ${Math.round(env.maxDocumentBytes / 1024 / 1024)} MB.`,
      413
    );
  }

  const storageKey = `restaurants/${req.user.restaurantId}/documents/${randomUUID()}-${safeFileName(parsed.data.fileName)}`;
  const uploadUrl = await createDocumentUploadUrl({
    key: storageKey,
    mimeType: parsed.data.mimeType,
  });

  return ok(res, {
    uploadUrl,
    storageKey,
    headers: {
      'Content-Type': parsed.data.mimeType,
    },
    expiresInSeconds: 600,
  });
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = documentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  if (
    parsed.data.storageKey &&
    !parsed.data.storageKey.startsWith(`restaurants/${req.user.restaurantId}/documents/`)
  ) {
    return fail(res, 'Arquivo não pertence a esta conta.', 403);
  }

  const document = await prisma.document.create({
    data: {
      restaurantId: req.user.restaurantId,
      uploadedById: req.user.userId,
      name: parsed.data.name,
      category: parsed.data.category,
      fileName: parsed.data.fileName || null,
      mimeType: parsed.data.mimeType || null,
      sizeBytes: parsed.data.sizeBytes || null,
      storageKey: parsed.data.storageKey || null,
      externalUrl: parsed.data.externalUrl || null,
      issuedAt: parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      reminderDays: parsed.data.reminderDays,
      notes: parsed.data.notes || null,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'Document',
    entityId: document.id,
    metadata: { category: document.category },
  });

  return ok(res, document, 201);
});

router.get('/:id/download-url', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const document = await prisma.document.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
      status: 'ACTIVE',
    },
  });

  if (!document) return fail(res, 'Documento não encontrado.', 404);
  if (document.externalUrl) return ok(res, { url: document.externalUrl });
  if (!document.storageKey) return fail(res, 'Documento sem arquivo vinculado.', 404);

  return ok(res, {
    url: await createDocumentDownloadUrl(document.storageKey),
  });
});

router.patch('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = documentSchema
    .pick({
      name: true,
      category: true,
      issuedAt: true,
      expiresAt: true,
      reminderDays: true,
      notes: true,
    })
    .partial()
    .safeParse(req.body);

  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const existing = await prisma.document.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!existing) return fail(res, 'Documento não encontrado.', 404);

  const document = await prisma.document.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      issuedAt: parsed.data.issuedAt
        ? new Date(parsed.data.issuedAt)
        : parsed.data.issuedAt,
      expiresAt: parsed.data.expiresAt
        ? new Date(parsed.data.expiresAt)
        : parsed.data.expiresAt,
    },
  });

  return ok(res, document);
});

router.delete('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const existing = await prisma.document.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!existing) return fail(res, 'Documento não encontrado.', 404);

  const document = await prisma.document.update({
    where: { id: existing.id },
    data: { status: 'ARCHIVED' },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'ARCHIVE',
    entity: 'Document',
    entityId: document.id,
  });

  return ok(res, document);
});

export default router;
