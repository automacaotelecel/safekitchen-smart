import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { sendAlertEmail } from '../../lib/email';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';
import {
  dispatchPendingEmails,
  generateAlertsForRestaurant,
  runAlertCycle,
} from './notifications.service';

const router = Router();

export async function alertJobHandler(req: Request, res: Response) {
  const secret = String(req.headers['x-job-secret'] || '');
  if (!env.alertJobSecret || secret !== env.alertJobSecret) {
    return fail(res, 'Chave do agendador inválida.', 401);
  }
  return ok(res, await runAlertCycle());
}

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  await generateAlertsForRestaurant(req.user.restaurantId);
  void dispatchPendingEmails(req.user.restaurantId).catch(console.error);

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const unreadOnly = String(req.query.unreadOnly || '') === '1';
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: req.user.userId },
  });
  if (preference && !preference.inAppEnabled) return ok(res, []);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.user.userId,
      restaurantId: req.user.restaurantId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return ok(res, notifications);
});

router.get('/summary', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: req.user.userId },
  });
  const unread = preference && !preference.inAppEnabled
    ? 0
    : await prisma.notification.count({
        where: { userId: req.user.userId, restaurantId: req.user.restaurantId, readAt: null },
      });
  return ok(res, { unread, emailEnabled: env.emailEnabled });
});

router.get('/preferences', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const preference = await prisma.notificationPreference.upsert({
    where: { userId: req.user.userId },
    create: { userId: req.user.userId },
    update: {},
  });
  return ok(res, preference);
});

router.patch('/preferences', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const parsed = z.object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    labelsEnabled: z.boolean().optional(),
    documentsEnabled: z.boolean().optional(),
    complianceEnabled: z.boolean().optional(),
    temperatureEnabled: z.boolean().optional(),
    deviceOfflineEnabled: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, 'Preferências inválidas.', 422, parsed.error.flatten());

  const preference = await prisma.notificationPreference.upsert({
    where: { userId: req.user.userId },
    create: { userId: req.user.userId, ...parsed.data },
    update: parsed.data,
  });
  return ok(res, preference);
});

router.post('/test-email', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  if (!env.emailEnabled) return fail(res, 'Envio de e-mail não configurado.', 503);
  try {
    await sendAlertEmail({
      to: req.user.email,
      title: 'E-mail de alertas configurado',
      message: 'Este é um teste do SafeKitchen Smart. Seus alertas por e-mail estão funcionando.',
      link: '/notificacoes',
      idempotencyKey: `test-${req.user.userId}-${Date.now()}`,
    });
    return ok(res, { sent: true });
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Falha no envio.', 502);
  }
});

router.post('/read-all', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.userId, restaurantId: req.user.restaurantId, readAt: null },
    data: { readAt: new Date() },
  });
  return ok(res, { updated: result.count });
});

router.patch('/:id/read', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const notification = await prisma.notification.findFirst({
    where: { id: String(req.params.id), userId: req.user.userId, restaurantId: req.user.restaurantId },
  });
  if (!notification) return fail(res, 'Notificação não encontrada.', 404);
  return ok(res, await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt || new Date() },
  }));
});

export default router;
