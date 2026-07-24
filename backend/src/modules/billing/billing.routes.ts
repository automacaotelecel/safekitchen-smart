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
import { emailContract, renderContractPdf } from './contracts.service';
import { confirmKitDelivery, createKitCheckout, syncKitPayment } from './kits.service';
import { getCommercialPlan, getCommercialPlans, type PlanCode } from './plans';

const router = Router();
const planSchema = z.object({
  planCode: z.enum(['START', 'PRO']),
});
const kitCheckoutSchema = planSchema.extend({
  customerName: z.string().trim().min(3).max(150),
  customerDocument: z.string().trim().min(11).max(20),
  customerPhone: z.string().trim().max(30).optional(),
  acceptedTerms: z.literal(true),
  termsVersion: z.string().trim().min(1),
  deliveryAddress: z.object({
    postalCode: z.string().trim().min(8).max(10),
    street: z.string().trim().min(3).max(150),
    number: z.string().trim().min(1).max(20),
    complement: z.string().trim().max(100).optional(),
    district: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  }),
});

function billingErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallback;
}

router.get('/plans', (_req, res) => {
  return ok(res, {
    enabled: env.mercadoPagoEnabled,
    activationPolicy: 'KIT_AND_SUBSCRIPTION_CONFIRMED',
    contractConfigured: env.contractProviderConfigured,
    contractTermsVersion: env.contractTermsVersion,
    contractProvider: env.contractProviderConfigured
      ? {
          name: env.contractProviderName,
          document: env.contractProviderDocument,
          email: env.contractProviderEmail,
          city: env.contractCity,
          deliveryDays: env.contractDeliveryDays,
        }
      : null,
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
    } else if (eventType === 'payment' && dataId) {
      const order = await syncKitPayment(dataId);
      restaurantId = order.restaurantId;
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

  const [restaurant, subscription, kitOrder, contract] = await Promise.all([
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
    prisma.kitOrder.findFirst({
      where: { restaurantId: req.user.restaurantId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.commercialContract.findFirst({
      where: { restaurantId: req.user.restaurantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contractNumber: true,
        version: true,
        status: true,
        customerEmail: true,
        acceptedAt: true,
        activatedAt: true,
        emailedAt: true,
        emailError: true,
      },
    }),
  ]);

  return ok(res, {
    enabled: env.mercadoPagoEnabled,
    restaurant,
    subscription,
    kitOrder,
    contract,
    contractConfigured: env.contractProviderConfigured,
    currentPlan: restaurant ? getCommercialPlan(restaurant.plan) || null : null,
  });
});

router.post('/kit-checkout', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  if (!env.mercadoPagoEnabled) {
    return fail(res, 'Os pagamentos estão temporariamente indisponíveis.', 503);
  }
  if (!env.contractProviderConfigured) {
    return fail(res, 'Os dados jurídicos do contrato ainda não foram configurados.', 503);
  }
  const parsed = kitCheckoutSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Revise os dados do contratante, endereço e aceite.', 422, parsed.error.flatten());
  if (parsed.data.termsVersion !== env.contractTermsVersion) {
    return fail(res, 'Os termos foram atualizados. Recarregue a página antes de aceitar.', 409);
  }

  try {
    const order = await createKitCheckout({
      restaurantId: req.user.restaurantId,
      userId: req.user.userId,
      payerEmail: req.user.email,
      planCode: parsed.data.planCode,
      customerName: parsed.data.customerName,
      customerDocument: parsed.data.customerDocument,
      customerPhone: parsed.data.customerPhone,
      deliveryAddress: parsed.data.deliveryAddress,
      acceptedIp: req.ip,
      acceptedUserAgent: req.get('user-agent'),
    });
    await recordAudit({
      restaurantId: req.user.restaurantId,
      userId: req.user.userId,
      action: 'KIT_CHECKOUT_CREATED',
      entity: 'KitOrder',
      entityId: order.id,
      metadata: { planCode: order.planCode, contractId: order.contract?.id },
    });
    return ok(res, { order, checkoutUrl: order.checkoutUrl }, 201);
  } catch (error) {
    const message = billingErrorMessage(error, 'Erro ao iniciar pagamento do kit.');
    console.error(`[billing] Falha ao criar checkout do kit: ${message}`);
    return fail(res, message, 502);
  }
});

router.post('/kit-sync', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const parsed = z.object({ paymentId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return fail(res, 'Identificador do pagamento ausente.', 422);
  try {
    const order = await syncKitPayment(parsed.data.paymentId);
    if (order.restaurantId !== req.user.restaurantId) return fail(res, 'Pagamento não pertence a esta conta.', 403);
    return ok(res, order);
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Erro ao sincronizar o kit.', 502);
  }
});

router.post('/kit-confirm-delivery', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  try {
    const result = await confirmKitDelivery(req.user.restaurantId);
    await recordAudit({
      restaurantId: req.user.restaurantId,
      userId: req.user.userId,
      action: 'CONFIRM_DELIVERY',
      entity: 'KitOrder',
      entityId: result.order.id,
    });
    return ok(res, result);
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Erro ao confirmar recebimento.', 409);
  }
});

router.get('/contract/pdf', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const contract = await prisma.commercialContract.findFirst({
    where: { restaurantId: req.user.restaurantId, status: 'ACTIVE' },
    orderBy: { activatedAt: 'desc' },
  });
  if (!contract) return fail(res, 'Nenhum contrato ativo encontrado.', 404);
  const pdf = await renderContractPdf(contract);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${contract.contractNumber}.pdf"`);
  return res.send(pdf);
});

router.post('/contract/resend', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const contract = await prisma.commercialContract.findFirst({
    where: { restaurantId: req.user.restaurantId, status: 'ACTIVE' },
    orderBy: { activatedAt: 'desc' },
  });
  if (!contract) return fail(res, 'Nenhum contrato ativo encontrado.', 404);
  try {
    return ok(res, await emailContract(contract.id, true));
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Erro ao reenviar contrato.', 502);
  }
});

router.post('/checkout', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  if (!env.mercadoPagoEnabled) {
    return fail(res, 'Os pagamentos estão temporariamente indisponíveis.', 503);
  }
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
    const message = billingErrorMessage(error, 'Erro ao iniciar contratação.');
    console.error(`[billing] Falha ao criar assinatura: ${message}`);
    return fail(res, message, 502);
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
