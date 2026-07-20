import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware, requireRole } from '../auth/auth.middleware';
import {
  requireActiveSubscription,
  subscriptionIsActive,
} from '../subscription/subscription.middleware';

const router = Router();

const categories = [
  'EQUIPMENT',
  'PREPARATION',
  'DELIVERY',
  'FRYING_OIL',
  'READY_FOOD',
  'REFRIGERATED_FOOD',
  'DISTRIBUTION',
  'RECEIVING',
] as const;

const readingSchema = z.object({
  pointId: z.string().optional().nullable(),
  category: z.enum(categories),
  subject: z.string().trim().min(2).max(160),
  temperatureC: z.number().min(-100).max(400),
  secondaryTemperatureC: z.number().min(-100).max(400).optional().nullable(),
  tertiaryTemperatureC: z.number().min(-100).max(400).optional().nullable(),
  occurredAt: z.string().datetime().optional(),
  responsibleName: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(1000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const pointSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(categories),
  minTemperature: z.number().min(-100).max(400).optional().nullable(),
  maxTemperature: z.number().min(-100).max(400).optional().nullable(),
  active: z.boolean().optional(),
});

const deviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  pointId: z.string().optional().nullable(),
  externalId: z.string().trim().max(160).optional().nullable(),
  protocol: z.enum(['API', 'WIFI', 'BLE_GATEWAY', 'MQTT']).default('API'),
});

function hashApiKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function validApiKey(rawKey: string, expectedHash: string) {
  const actual = Buffer.from(hashApiKey(rawKey), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readingStatus(
  temperatureC: number,
  point?: { minTemperature: number | null; maxTemperature: number | null } | null
) {
  if (!point) return 'NORMAL';
  if (point.minTemperature !== null && temperatureC < point.minTemperature) return 'ALERT';
  if (point.maxTemperature !== null && temperatureC > point.maxTemperature) return 'ALERT';
  return 'NORMAL';
}

async function findTenantPoint(pointId: string | null | undefined, restaurantId: string) {
  if (!pointId) return null;

  return prisma.temperaturePoint.findFirst({
    where: {
      id: pointId,
      restaurantId,
      active: true,
    },
  });
}

router.post('/ingest/:deviceId', async (req, res) => {
  const rawKey = String(req.headers['x-device-key'] || '');
  if (!rawKey) return fail(res, 'Chave do dispositivo não enviada.', 401);

  const parsed = readingSchema
    .omit({ pointId: true, responsibleName: true })
    .safeParse(req.body);

  if (!parsed.success) return fail(res, 'Leitura inválida.', 422, parsed.error.flatten());

  const device = await prisma.temperatureDevice.findFirst({
    where: {
      id: String(req.params.deviceId),
      active: true,
    },
    include: {
      point: true,
      restaurant: {
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
        },
      },
    },
  });

  if (!device?.apiKeyHash || !validApiKey(rawKey, device.apiKeyHash)) {
    return fail(res, 'Dispositivo ou chave inválidos.', 401);
  }

  if (!subscriptionIsActive(device.restaurant)) {
    return fail(res, 'Assinatura inativa.', 402);
  }

  const point = device.point;
  const reading = await prisma.$transaction(async (tx) => {
    const created = await tx.temperatureReading.create({
      data: {
        restaurantId: device.restaurantId,
        pointId: point?.id || null,
        deviceId: device.id,
        category: parsed.data.category,
        subject: parsed.data.subject,
        temperatureC: parsed.data.temperatureC,
        secondaryTemperatureC: parsed.data.secondaryTemperatureC,
        tertiaryTemperatureC: parsed.data.tertiaryTemperatureC,
        occurredAt: parsed.data.occurredAt
          ? new Date(parsed.data.occurredAt)
          : new Date(),
        source: 'DEVICE',
        status: readingStatus(parsed.data.temperatureC, point),
        responsibleName: `Dispositivo: ${device.name}`,
        notes: parsed.data.notes || null,
        metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await tx.temperatureDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return created;
  });

  return ok(res, reading, 201);
});

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get('/summary', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = {
    restaurantId: req.user.restaurantId,
    occurredAt: { gte: since },
  };

  const [total24h, alerts24h, latest, activeDevices] = await Promise.all([
    prisma.temperatureReading.count({ where }),
    prisma.temperatureReading.count({
      where: {
        ...where,
        status: 'ALERT',
      },
    }),
    prisma.temperatureReading.findMany({
      where: {
        restaurantId: req.user.restaurantId,
      },
      include: {
        point: {
          select: {
            id: true,
            name: true,
            minTemperature: true,
            maxTemperature: true,
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 12,
    }),
    prisma.temperatureDevice.count({
      where: {
        restaurantId: req.user.restaurantId,
        active: true,
      },
    }),
  ]);

  return ok(res, { total24h, alerts24h, activeDevices, latest });
});

router.get('/points', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const points = await prisma.temperaturePoint.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      ...(String(req.query.includeInactive || '') === '1' ? {} : { active: true }),
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  return ok(res, points);
});

router.post('/points', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = pointSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const point = await prisma.temperaturePoint.create({
    data: {
      restaurantId: req.user.restaurantId,
      ...parsed.data,
      active: parsed.data.active ?? true,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'TemperaturePoint',
    entityId: point.id,
  });

  return ok(res, point, 201);
});

router.patch('/points/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = pointSchema.partial().safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const point = await prisma.temperaturePoint.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!point) return fail(res, 'Ponto de medição não encontrado.', 404);

  const updated = await prisma.temperaturePoint.update({
    where: { id: point.id },
    data: parsed.data,
  });

  return ok(res, updated);
});

router.get('/readings', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const category = String(req.query.category || '');
  const pointId = String(req.query.pointId || '');
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');

  const readings = await prisma.temperatureReading.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      ...(categories.includes(category as (typeof categories)[number])
        ? { category }
        : {}),
      ...(pointId ? { pointId } : {}),
      ...(from || to
        ? {
            occurredAt: {
              ...(from && !Number.isNaN(new Date(from).getTime())
                ? { gte: new Date(from) }
                : {}),
              ...(to && !Number.isNaN(new Date(to).getTime())
                ? { lte: new Date(to) }
                : {}),
            },
          }
        : {}),
    },
    include: {
      point: {
        select: {
          id: true,
          name: true,
          minTemperature: true,
          maxTemperature: true,
        },
      },
      device: {
        select: {
          id: true,
          name: true,
          protocol: true,
        },
      },
    },
    orderBy: { occurredAt: 'desc' },
    take: limit,
  });

  return ok(res, readings);
});

router.post('/readings', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const point = await findTenantPoint(parsed.data.pointId, req.user.restaurantId);
  if (parsed.data.pointId && !point) {
    return fail(res, 'Ponto de medição inválido.', 422);
  }

  const reading = await prisma.temperatureReading.create({
    data: {
      restaurantId: req.user.restaurantId,
      createdById: req.user.userId,
      pointId: point?.id || null,
      category: parsed.data.category,
      subject: parsed.data.subject,
      temperatureC: parsed.data.temperatureC,
      secondaryTemperatureC: parsed.data.secondaryTemperatureC,
      tertiaryTemperatureC: parsed.data.tertiaryTemperatureC,
      occurredAt: parsed.data.occurredAt
        ? new Date(parsed.data.occurredAt)
        : new Date(),
      source: 'MANUAL',
      status: readingStatus(parsed.data.temperatureC, point),
      responsibleName: parsed.data.responsibleName,
      notes: parsed.data.notes || null,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    },
    include: {
      point: true,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'TemperatureReading',
    entityId: reading.id,
    metadata: {
      category: reading.category,
      status: reading.status,
      source: reading.source,
    },
  });

  return ok(res, reading, 201);
});

router.get('/devices', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const devices = await prisma.temperatureDevice.findMany({
    where: {
      restaurantId: req.user.restaurantId,
    },
    select: {
      id: true,
      pointId: true,
      name: true,
      externalId: true,
      protocol: true,
      active: true,
      lastSeenAt: true,
      metadata: true,
      createdAt: true,
      point: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  return ok(res, devices);
});

router.post('/devices', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = deviceSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const point = await findTenantPoint(parsed.data.pointId, req.user.restaurantId);
  if (parsed.data.pointId && !point) {
    return fail(res, 'Ponto de medição inválido.', 422);
  }

  const apiKey = randomBytes(32).toString('hex');
  const device = await prisma.temperatureDevice.create({
    data: {
      restaurantId: req.user.restaurantId,
      pointId: point?.id || null,
      name: parsed.data.name,
      externalId: parsed.data.externalId || null,
      protocol: parsed.data.protocol,
      apiKeyHash: hashApiKey(apiKey),
    },
    select: {
      id: true,
      pointId: true,
      name: true,
      externalId: true,
      protocol: true,
      active: true,
      createdAt: true,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'TemperatureDevice',
    entityId: device.id,
  });

  return ok(
    res,
    {
      device,
      apiKey,
      ingestPath: `/api/temperature/ingest/${device.id}`,
      warning: 'Guarde a chave agora. Ela não será exibida novamente.',
    },
    201
  );
});

export default router;
