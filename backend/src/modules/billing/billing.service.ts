import { addDays } from 'date-fns';
import {
  Invoice,
  MercadoPagoConfig,
  PreApproval,
} from 'mercadopago';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { getCommercialPlan, type PlanCode } from './plans';
import { createSystemNotification } from '../notifications/notifications.service';
import { activateContractIfEligible } from './contracts.service';

function client(): MercadoPagoConfig {
  if (!env.mercadoPagoAccessToken) {
    throw new Error('Mercado Pago não configurado no servidor.');
  }

  return new MercadoPagoConfig({
    accessToken: env.mercadoPagoAccessToken,
    options: { timeout: 15_000 },
  });
}

function providerStatus(status?: string) {
  switch (status) {
    case 'authorized':
      return 'ACTIVE';
    case 'paused':
      return 'PAST_DUE';
    case 'cancelled':
      return 'CANCELED';
    default:
      return 'PENDING';
  }
}

function referenceParts(value?: string) {
  const [restaurantId, planCode] = String(value || '').split(':');
  const plan = getCommercialPlan(planCode || '');
  return restaurantId && plan ? { restaurantId, plan } : null;
}

export async function createMercadoPagoCheckout(input: {
  restaurantId: string;
  payerEmail: string;
  planCode: PlanCode;
}) {
  const plan = getCommercialPlan(input.planCode);
  if (!plan) throw new Error('Plano inválido.');

  const approvedKit = await prisma.kitOrder.findFirst({
    where: { restaurantId: input.restaurantId, planCode: plan.code, status: 'APPROVED' },
  });
  if (!approvedKit?.deliveredAt) {
    throw new Error('Confirme primeiro o recebimento do kit para autorizar a mensalidade.');
  }

  const current = await prisma.subscription.findUnique({
    where: { restaurantId: input.restaurantId },
  });

  if (current?.status === 'PENDING' && current.checkoutUrl && current.providerSubscriptionId) {
    if (current.planCode !== plan.code) {
      await new PreApproval(client()).update({
        id: current.providerSubscriptionId,
        body: {
          reason: `SafeKitchen Smart - Plano ${plan.name}`,
          external_reference: `${input.restaurantId}:${plan.code}`,
          auto_recurring: {
            transaction_amount: plan.amountCents / 100,
            currency_id: 'BRL',
          },
        },
      });
      return prisma.subscription.update({
        where: { id: current.id },
        data: { planCode: plan.code, amountCents: plan.amountCents },
      });
    }
    return current;
  }

  if (current?.status === 'ACTIVE' && current.providerSubscriptionId) {
    throw new Error('A conta já possui assinatura ativa. Use a alteração de plano.');
  }

  const preApproval = new PreApproval(client());
  const response = await preApproval.create({
    body: {
      reason: `SafeKitchen Smart - Plano ${plan.name}`,
      external_reference: `${input.restaurantId}:${plan.code}`,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: plan.amountCents / 100,
        currency_id: 'BRL',
      },
      back_url: `${env.frontendUrl.split(',')[0].replace(/\/$/, '')}/assinatura?checkout=retorno`,
      status: 'pending',
      notification_url: `${env.backendUrl}/api/billing/webhooks/mercado-pago`,
    } as never,
  });

  if (!response.id || !response.init_point) {
    throw new Error('O Mercado Pago não devolveu o link de contratação.');
  }

  return prisma.subscription.upsert({
    where: { restaurantId: input.restaurantId },
    create: {
      restaurantId: input.restaurantId,
      planCode: plan.code,
      status: providerStatus(response.status),
      providerSubscriptionId: response.id,
      payerEmail: input.payerEmail,
      checkoutUrl: response.init_point,
      amountCents: plan.amountCents,
      currency: plan.currency,
      currentPeriodEnd: response.next_payment_date
        ? new Date(response.next_payment_date)
        : null,
    },
    update: {
      planCode: plan.code,
      status: providerStatus(response.status),
      providerSubscriptionId: response.id,
      payerEmail: input.payerEmail,
      checkoutUrl: response.init_point,
      amountCents: plan.amountCents,
      currency: plan.currency,
      currentPeriodEnd: response.next_payment_date
        ? new Date(response.next_payment_date)
        : null,
      canceledAt: null,
    },
  });
}

export async function syncMercadoPagoSubscription(providerSubscriptionId: string) {
  const response = await new PreApproval(client()).get({ id: providerSubscriptionId });
  const existing = await prisma.subscription.findFirst({
    where: { providerSubscriptionId },
  });
  const reference = referenceParts(response.external_reference);
  const restaurantId = existing?.restaurantId || reference?.restaurantId;
  const plan = getCommercialPlan(existing?.planCode || reference?.plan.code || '');

  if (!restaurantId || !plan) {
    throw new Error('Assinatura sem referência válida para uma conta do SafeKitchen.');
  }

  const [restaurant, approvedKit] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    prisma.kitOrder.findFirst({ where: { restaurantId, planCode: plan.code, status: 'APPROVED' } }),
  ]);
  if (!restaurant) throw new Error('Conta vinculada à assinatura não encontrada.');

  const status = providerStatus(response.status);
  const now = new Date();
  const trialStillActive = Boolean(
    restaurant.subscriptionStatus === 'TRIALING' &&
      restaurant.trialEndsAt &&
      restaurant.trialEndsAt >= now
  );
  const accountStatus =
    status === 'ACTIVE' && approvedKit?.deliveredAt
      ? 'ACTIVE'
      : status === 'ACTIVE' && approvedKit
        ? 'AWAITING_DELIVERY'
        : status === 'ACTIVE'
        ? 'PENDING_KIT'
        : status === 'PENDING' && trialStillActive
          ? 'TRIALING'
          : status;

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        planCode: plan.code,
        status,
        providerSubscriptionId,
        payerEmail: response.payer_email || null,
        checkoutUrl: response.init_point || null,
        amountCents: Math.round(
          Number(response.auto_recurring?.transaction_amount || plan.amountCents / 100) * 100
        ),
        currency: response.auto_recurring?.currency_id || 'BRL',
        currentPeriodEnd: response.next_payment_date
          ? new Date(response.next_payment_date)
          : null,
        canceledAt: status === 'CANCELED' ? now : null,
      },
      update: {
        planCode: plan.code,
        status,
        providerSubscriptionId,
        payerEmail: response.payer_email || undefined,
        checkoutUrl: response.init_point || undefined,
        amountCents: Math.round(
          Number(response.auto_recurring?.transaction_amount || plan.amountCents / 100) * 100
        ),
        currency: response.auto_recurring?.currency_id || 'BRL',
        currentPeriodEnd: response.next_payment_date
          ? new Date(response.next_payment_date)
          : null,
        canceledAt: status === 'CANCELED' ? now : null,
      },
    }),
    prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        plan: status === 'ACTIVE' && approvedKit?.deliveredAt ? plan.code : restaurant.plan,
        maxUsers: status === 'ACTIVE' && approvedKit?.deliveredAt ? plan.maxUsers : restaurant.maxUsers,
        subscriptionStatus: accountStatus,
        subscriptionEndsAt:
          status === 'ACTIVE'
            ? null
            : status === 'CANCELED'
              ? now
              : restaurant.subscriptionEndsAt,
      },
    }),
  ]);

  if (status === 'ACTIVE') {
    await createSystemNotification({
      restaurantId,
      type: 'SUBSCRIPTION_ACTIVE',
      severity: 'INFO',
      title: 'Assinatura confirmada',
      message: approvedKit?.deliveredAt
        ? `O plano ${plan.name} está ativo e os recursos foram liberados.`
        : `A mensalidade do plano ${plan.name} foi autorizada. Confirme o recebimento do kit para liberar o sistema.`,
      link: '/assinatura',
      dedupeKey: `billing:${providerSubscriptionId}:active`,
    });
    await activateContractIfEligible(restaurantId);
  } else if (status === 'CANCELED') {
    await createSystemNotification({
      restaurantId,
      type: 'SUBSCRIPTION_CANCELED',
      severity: 'WARNING',
      title: 'Assinatura cancelada',
      message: 'A assinatura do SafeKitchen Smart foi cancelada.',
      link: '/assinatura',
      dedupeKey: `billing:${providerSubscriptionId}:canceled`,
    });
  }

  return prisma.subscription.findUnique({ where: { restaurantId } });
}

export async function syncMercadoPagoInvoice(invoiceId: string) {
  const invoice = await new Invoice(client()).get({ id: invoiceId });
  if (!invoice.preapproval_id) throw new Error('Fatura sem assinatura vinculada.');

  const subscription = await prisma.subscription.findFirst({
    where: { providerSubscriptionId: invoice.preapproval_id },
  });
  if (!subscription) throw new Error('Assinatura da fatura não encontrada.');

  const approved = invoice.payment?.status === 'approved';
  const rejected = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(
    String(invoice.payment?.status || '')
  );

  if (approved) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE' },
    });
    await activateContractIfEligible(subscription.restaurantId);
    await createSystemNotification({
      restaurantId: subscription.restaurantId,
      type: 'PAYMENT_APPROVED',
      severity: 'INFO',
      title: 'Pagamento aprovado',
      message: 'A renovação do SafeKitchen Smart foi confirmada.',
      link: '/assinatura',
      dedupeKey: `invoice:${invoice.id}:approved`,
    });
  } else if (rejected) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' },
      }),
      prisma.restaurant.update({
        where: { id: subscription.restaurantId },
        data: { subscriptionStatus: 'PAST_DUE', subscriptionEndsAt: addDays(new Date(), 3) },
      }),
    ]);
    await createSystemNotification({
      restaurantId: subscription.restaurantId,
      type: 'PAYMENT_FAILED',
      severity: 'CRITICAL',
      title: 'Problema na renovação',
      message: 'O pagamento não foi aprovado. Regularize a assinatura nos próximos 3 dias para evitar o bloqueio.',
      link: '/assinatura',
      dedupeKey: `invoice:${invoice.id}:failed`,
    });
  }

  return { subscription, invoice, approved, rejected };
}

export async function changeMercadoPagoPlan(input: {
  restaurantId: string;
  planCode: PlanCode;
}) {
  void input;
  throw new Error('A troca entre kits exige ajuste de equipamentos. Solicite o upgrade ao suporte comercial.');
}

export async function cancelMercadoPagoSubscription(restaurantId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { restaurantId } });
  if (!subscription?.providerSubscriptionId) throw new Error('Assinatura não encontrada.');

  await new PreApproval(client()).update({
    id: subscription.providerSubscriptionId,
    body: { status: 'cancelled' },
  });

  const now = new Date();
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELED', canceledAt: now, checkoutUrl: null },
    }),
    prisma.restaurant.update({
      where: { id: restaurantId },
      data: { subscriptionStatus: 'CANCELED', subscriptionEndsAt: now },
    }),
  ]);

  return prisma.subscription.findUnique({ where: { restaurantId } });
}
