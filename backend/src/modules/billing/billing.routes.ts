import { randomUUID } from 'crypto';

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import { z } from 'zod';

import { env } from '../../config/env';
import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware, requireRole } from '../auth/auth.middleware';
import {
  cancelMercadoPagoSubscription,
  changeMercadoPagoPlan,
  createMercadoPagoCheckout,
  syncMercadoPagoInvoice,
  syncMercadoPagoSubscription,
} from './billing.service';
import { getCommercialPlan, getCommercialPlans, type PlanCode } from './plans';

const router = Router();
const planSchema = z.object({
  planCode: z.enum(['ESSENTIAL', 'PROFESSIONAL', 'PREMIUM']),
});

router.get('/plans', (_req, res) => {
  return ok(res, {
    enabled: env.mercadoPagoEnabled,
    trialDays: 7,
    plans: getCommercialPlans(),
  });
});

router.post('/webhooks/mercado-pago', async (req, res) => {
  if (!env.mercadoPagoWebhookSecret) {
    return fail(res, 'Webhook do Mercado Pago não configurado.', 503);
  }

  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers['x-signature'],
      xRequestId: req.headers['x-request-id'],
      dataId,
      secret: env.mercadoPagoWebhookSecret,
      toleranceSeconds: 600,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return fail(res, 'Assinatura do webhook inválida.', 401);
    }
    throw error;
  }

  const eventType = String(req.body?.type || req.query.type || 'unknown');
  const providerEventId = String(
    req.body?.id || req.headers['x-request-id'] || `${eventType}:${dataId}:${randomUUID()}`
  );

  const previous = await prisma.paymentEvent.findUnique({ where: { providerEventId } });
  if (previous?.processedAt) return ok(res, { received: true, duplicated: true });

  const event = await prisma.paymentEvent.upsert({
    where: { providerEventId },
    create: {
      providerEventId,
      eventType,
      resourceId: dataId || null,
      payload: req.body as Prisma.InputJsonValue,
    },
    update: {
      eventType,
      resourceId: dataId || null,
      payload: req.body as Prisma.InputJsonValue,
      processingError: null,
    },
  });

  try {
    let restaurantId: string | null = null;
    if (eventType === 'subscription_preapproval' && dataId) {
      const subscription = await syncMercadoPagoSubscription(dataId);
      restaurantId = subscription?.restaurantId || null;
    } else if (eventType === 'subscription_authorized_payment' && dataId) {
      const result = await syncMercadoPagoInvoice(dataId);
      restaurantId = result.subscription.restaurantId;
    }

    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: { restaurantId, processedAt: new Date(), processingError: null },
    });

    return ok(res, { received: true });
  } catch (error) {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: {
        processingError: (error instanceof Error ? error.message : 'Erro no webhook').slice(0, 500),
      },
    });
    return fail(res, 'Não foi possível processar o evento.', 500);
  }
});

router.use(authMiddleware);

router.get('/subscription', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const [restaurant, subscription] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: {
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        maxUsers: true,
      },
    }),
    prisma.subscription.findUnique({ where: { restaurantId: req.user.restaurantId } }),
  ]);

  return ok(res, {
    enabled: env.mercadoPagoEnabled,
    restaurant,
    subscription,
    currentPlan: restaurant ? getCommercialPlan(restaurant.plan) || null : null,
  });
});

router.post('/checkout', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Plano inválido.', 422);

  try {
    const subscription = await createMercadoPagoCheckout({
      restaurantId: req.user.restaurantId,
      payerEmail: req.user.email,
      planCode: parsed.data.planCode,
    });

    await recordAudit({
      restaurantId: req.user.restaurantId,
      userId: req.user.userId,
      action: 'CHECKOUT_CREATED',
      entity: 'Subscription',
      entityId: subscription.id,
      metadata: { planCode: subscription.planCode },
    });

    return ok(res, { subscription, checkoutUrl: subscription.checkoutUrl }, 201);
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Erro ao iniciar contratação.', 502);
  }
});

router.post('/change-plan', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Plano inválido.', 422);

  try {
    const subscription = await changeMercadoPagoPlan({
      restaurantId: req.user.restaurantId,
      planCode: parsed.data.planCode as PlanCode,
    });
    return ok(res, subscription);
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Erro ao alterar plano.', 502);
  }
});

router.post('/sync', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId: req.user.restaurantId },
  });
  if (!subscription?.providerSubscriptionId) {
    return fail(res, 'Nenhuma assinatura encontrada.', 404);
  }

  try {
    return ok(res, await syncMercadoPagoSubscription(subscription.providerSubscriptionId));
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Erro ao sincronizar assinatura.', 502);
  }
});

router.post('/cancel', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  try {
    const subscription = await cancelMercadoPagoSubscription(req.user.restaurantId);
    await recordAudit({
      restaurantId: req.user.restaurantId,
      userId: req.user.userId,
      action: 'CANCEL',
      entity: 'Subscription',
      entityId: subscription?.id,
    });
    return ok(res, subscription);
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Erro ao cancelar assinatura.', 502);
  }
});

export default router;
