import { Router } from 'express';
import { z } from 'zod';

import { recordAudit } from '../../lib/audit';
import { fail } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware, requireRole } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';
import { generateComplianceDossier } from './dossier.service';
import {
  generateOperationalWorkbook,
  operationalExportKinds,
} from './operational-workbook.service';

const router = Router();
router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get('/compliance-dossier', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).safeParse(req.query);
  if (!parsed.success) return fail(res, 'Período inválido.', 422);

  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - 30 * 86_400_000);
  if (from > to || to.getTime() - from.getTime() > 366 * 86_400_000) {
    return fail(res, 'Escolha um período de até 366 dias.', 422);
  }

  const [restaurant, labels, documents, temperatures, controls, audits] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: { name: true, document: true, timezone: true },
    }),
    prisma.label.findMany({
      where: { restaurantId: req.user.restaurantId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      take: 5_000,
    }),
    prisma.document.findMany({
      where: { restaurantId: req.user.restaurantId, status: 'ACTIVE' },
      orderBy: { expiresAt: 'asc' },
      take: 1_000,
    }),
    prisma.temperatureReading.findMany({
      where: { restaurantId: req.user.restaurantId, occurredAt: { gte: from, lte: to } },
      orderBy: { occurredAt: 'desc' },
      take: 5_000,
    }),
    prisma.complianceRecord.findMany({
      where: { restaurantId: req.user.restaurantId, status: 'ACTIVE', occurredAt: { lte: to } },
      orderBy: { occurredAt: 'desc' },
      take: 1_000,
    }),
    prisma.auditLog.findMany({
      where: { restaurantId: req.user.restaurantId, createdAt: { gte: from, lte: to } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1_000,
    }),
  ]);

  if (!restaurant) return fail(res, 'Conta não encontrada.', 404);
  const buffer = await generateComplianceDossier({
    restaurant,
    generatedBy: req.user.name,
    from,
    to,
    labels,
    documents,
    temperatures,
    controls,
    audits,
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'EXPORT',
    entity: 'ComplianceDossier',
    metadata: { from: from.toISOString(), to: to.toISOString() },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="dossie-safekitchen.pdf"');
  return res.send(buffer);
});

router.get('/operational-sheet', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = z
    .object({
      kind: z.enum(operationalExportKinds),
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .safeParse(req.query);

  if (!parsed.success) return fail(res, 'Tipo ou período inválido.', 422);

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (from > to || to.getTime() - from.getTime() > 366 * 86_400_000) {
    return fail(res, 'Escolha um período de até 366 dias.', 422);
  }

  const temperatureKinds = new Set([
    'EQUIPMENT',
    'PREPARATION',
    'DELIVERY',
    'FRYING_OIL',
    'READY_FOOD',
    'REFRIGERATED_FOOD',
    'DISTRIBUTION',
  ]);
  const isTemperature = temperatureKinds.has(parsed.data.kind);
  const [restaurant, temperatures, controls] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: { name: true },
    }),
    isTemperature || parsed.data.kind === 'RECEIVING'
      ? prisma.temperatureReading.findMany({
          where: {
            restaurantId: req.user.restaurantId,
            category: parsed.data.kind,
            occurredAt: { gte: from, lte: to },
          },
          orderBy: { occurredAt: 'asc' },
          take: 10_000,
        })
      : Promise.resolve([]),
    !isTemperature
      ? prisma.complianceRecord.findMany({
          where: {
            restaurantId: req.user.restaurantId,
            type: parsed.data.kind,
            status: 'ACTIVE',
            occurredAt: { gte: from, lte: to },
          },
          orderBy: { occurredAt: 'asc' },
          take: 10_000,
        })
      : Promise.resolve([]),
  ]);

  if (!restaurant) return fail(res, 'Conta não encontrada.', 404);

  const buffer = await generateOperationalWorkbook({
    kind: parsed.data.kind,
    restaurantName: restaurant.name,
    from,
    to,
    temperatures,
    controls,
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'EXPORT',
    entity: 'OperationalSpreadsheet',
    metadata: {
      kind: parsed.data.kind,
      from: from.toISOString(),
      to: to.toISOString(),
    },
  });

  const fileName = `controle-${parsed.data.kind.toLowerCase().replace(/_/g, '-')}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  return res.send(buffer);
});

export default router;
