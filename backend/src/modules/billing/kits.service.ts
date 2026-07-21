import type { Prisma } from '@prisma/client';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { createSystemNotification } from '../notifications/notifications.service';
import {
  activateContractIfEligible,
  contractHash,
  createContractSnapshot,
  newContractNumber,
} from './contracts.service';
import { getCommercialPlan, type PlanCode } from './plans';

export type KitCheckoutInput = {
  restaurantId: string;
  userId: string;
  payerEmail: string;
  planCode: PlanCode;
  customerName: string;
  customerDocument: string;
  customerPhone?: string;
  deliveryAddress: {
    postalCode: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  };
  acceptedIp?: string;
  acceptedUserAgent?: string;
};

function client() {
  if (!env.mercadoPagoAccessToken) throw new Error('Mercado Pago não configurado no servidor.');
  return new MercadoPagoConfig({ accessToken: env.mercadoPagoAccessToken, options: { timeout: 15_000 } });
}

export async function createKitCheckout(input: KitCheckoutInput) {
  const plan = getCommercialPlan(input.planCode);
  if (!plan) throw new Error('Plano inválido.');

  const paid = await prisma.kitOrder.findFirst({
    where: { restaurantId: input.restaurantId, status: 'APPROVED' },
    orderBy: { paidAt: 'desc' },
  });
  if (paid) throw new Error('Esta conta já possui um kit pago.');

  const pending = await prisma.kitOrder.findFirst({
    where: { restaurantId: input.restaurantId, status: 'PENDING', planCode: plan.code },
    orderBy: { createdAt: 'desc' },
    include: { contract: true },
  });
  if (pending?.checkoutUrl && pending.contract?.version === env.contractTermsVersion) return pending;

  const acceptedAt = new Date();
  const snapshot = createContractSnapshot({
    customerName: input.customerName,
    customerEmail: input.payerEmail,
    customerDocument: input.customerDocument,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    planCode: plan.code,
    acceptedAt,
  });

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.kitOrder.create({
      data: {
        restaurantId: input.restaurantId,
        planCode: plan.code,
        amountCents: plan.setupAmountCents,
        payerEmail: input.payerEmail,
        customerName: input.customerName,
        customerDocument: input.customerDocument,
        customerPhone: input.customerPhone || null,
        deliveryAddress: input.deliveryAddress as Prisma.InputJsonValue,
      },
    });
    await tx.commercialContract.create({
      data: {
        restaurantId: input.restaurantId,
        kitOrderId: created.id,
        acceptedById: input.userId,
        contractNumber: newContractNumber(),
        version: env.contractTermsVersion,
        customerName: input.customerName,
        customerEmail: input.payerEmail,
        customerDocument: input.customerDocument,
        customerPhone: input.customerPhone || null,
        planCode: plan.code,
        setupAmountCents: plan.setupAmountCents,
        monthlyAmountCents: plan.amountCents,
        termsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        contentHash: contractHash(snapshot),
        acceptedAt,
        acceptedIp: input.acceptedIp || null,
        acceptedUserAgent: input.acceptedUserAgent?.slice(0, 500) || null,
      },
    });
    return created;
  });

  try {
    const baseUrl = env.frontendUrl.split(',')[0].replace(/\/$/, '');
    const response = await new Preference(client()).create({
      body: {
        items: [
          {
            id: `sks-kit-${plan.code.toLowerCase()}`,
            title: `SafeKitchen Smart - Kit ${plan.name}`,
            description: plan.kitItems.join('; ').slice(0, 250),
            quantity: 1,
            unit_price: plan.setupAmountCents / 100,
            currency_id: 'BRL',
          },
        ],
        payer: { email: input.payerEmail, name: input.customerName },
        external_reference: `kit:${order.id}`,
        back_urls: {
          success: `${baseUrl}/assinatura?kit=approved`,
          pending: `${baseUrl}/assinatura?kit=pending`,
          failure: `${baseUrl}/assinatura?kit=failure`,
        },
        auto_return: 'approved',
        notification_url: `${env.backendUrl}/api/billing/webhooks/mercado-pago`,
        statement_descriptor: 'SAFEKITCHEN',
      },
    });
    if (!response.id || !response.init_point) throw new Error('O Mercado Pago não devolveu o checkout do kit.');

    return prisma.kitOrder.update({
      where: { id: order.id },
      data: { providerPreferenceId: response.id, checkoutUrl: response.init_point },
      include: { contract: true },
    });
  } catch (error) {
    await prisma.kitOrder.update({ where: { id: order.id }, data: { status: 'ERROR' } });
    throw error;
  }
}

function kitPaymentStatus(status?: string) {
  if (status === 'approved') return 'APPROVED';
  if (status === 'refunded') return 'REFUNDED';
  if (status === 'charged_back') return 'CHARGED_BACK';
  if (status === 'cancelled' || status === 'rejected') return 'REJECTED';
  return 'PENDING';
}

export async function syncKitPayment(paymentId: string) {
  const payment = await new Payment(client()).get({ id: paymentId });
  const reference = String(payment.external_reference || '');
  if (!reference.startsWith('kit:')) throw new Error('Pagamento sem referência de kit válida.');
  const orderId = reference.slice(4);
  const order = await prisma.kitOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Pedido do kit não encontrado.');

  const amountCents = Math.round(Number(payment.transaction_amount || 0) * 100);
  if (amountCents !== order.amountCents || payment.currency_id !== order.currency) {
    throw new Error('Valor ou moeda do pagamento não corresponde ao pedido.');
  }

  const status = kitPaymentStatus(payment.status);
  const updated = await prisma.kitOrder.update({
    where: { id: order.id },
    data: {
      status,
      providerPaymentId: String(payment.id),
      paidAt: status === 'APPROVED' ? order.paidAt || new Date() : order.paidAt,
    },
    include: { contract: true },
  });

  if (status === 'APPROVED') {
    if (updated.contract?.status === 'ACCEPTED_PENDING_PAYMENT') {
      await prisma.commercialContract.update({
        where: { id: updated.contract.id },
        data: { status: 'KIT_PAID_PENDING_SUBSCRIPTION' },
      });
    }
    await createSystemNotification({
      restaurantId: order.restaurantId,
      type: 'KIT_PAYMENT_APPROVED',
      severity: 'INFO',
      title: 'Pagamento do kit aprovado',
      message: 'Agora autorize a mensalidade para concluir a contratação e receber seu contrato.',
      link: '/assinatura',
      dedupeKey: `kit:${order.id}:approved`,
    });
    await activateContractIfEligible(order.restaurantId);
  }
  return updated;
}
