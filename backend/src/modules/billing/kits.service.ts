import type { Prisma } from '@prisma/client';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

import { env } from '../../config/env';
import { sendEmail } from '../../lib/email';
import { prisma } from '../../lib/prisma';
import { createSystemNotification } from '../notifications/notifications.service';
import {
  activateContractIfEligible,
  contractHash,
  createContractSnapshot,
  emailContract,
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

function htmlEscape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!
  );
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
      fulfillmentStatus: status === 'APPROVED' ? 'PREPARING' : order.fulfillmentStatus,
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

    let contractEmailed = Boolean(updated.contract?.emailedAt);
    if (updated.contract && !updated.contract.emailedAt) {
      try {
        const emailed = await emailContract(updated.contract.id);
        contractEmailed = Boolean(emailed.emailedAt);
      } catch (error) {
        console.error('Falha ao enviar confirmação da contratação:', error);
      }
    }

    await createSystemNotification({
      restaurantId: order.restaurantId,
      type: 'KIT_PAYMENT_APPROVED',
      severity: 'INFO',
      title: 'Pagamento do kit aprovado',
      message: contractEmailed
        ? 'A confirmação e o contrato foram enviados por e-mail. Aguarde o kit e confirme o recebimento para autorizar a mensalidade.'
        : 'Pagamento confirmado. O envio do contrato por e-mail está pendente. Aguarde o kit e confirme o recebimento para autorizar a mensalidade.',
      link: '/assinatura',
      dedupeKey: `kit:${order.id}:approved`,
    });
    await activateContractIfEligible(order.restaurantId);
  }
  return updated;
}

export async function emailKitShipment(orderId: string, forceResend = false) {
  const order = await prisma.kitOrder.findUnique({
    where: { id: orderId },
    include: { contract: true },
  });
  if (!order) throw new Error('Pedido do kit não encontrado.');
  if (order.status !== 'APPROVED') throw new Error('O kit ainda não está pago.');
  if (!order.shippedAt || !order.trackingCode) throw new Error('O despacho ainda não foi registrado.');
  if (order.shippingEmailedAt && !forceResend) return order;

  const plan = getCommercialPlan(order.planCode);
  if (!plan) throw new Error('Plano do kit não encontrado.');
  const trackingLink = order.trackingUrl
    ? `<a href="${htmlEscape(order.trackingUrl)}" style="display:inline-block;margin-top:14px;background:#16c79a;color:#073b4c;text-decoration:none;padding:13px 20px;border-radius:13px;font-weight:800">Acompanhar entrega</a>`
    : '';

  try {
    const result = await sendEmail({
      to: order.payerEmail,
      subject: `Seu kit ${plan.name} foi enviado`,
      idempotencyKey: forceResend
        ? `kit:${order.id}:shipped:resend:${Date.now()}`
        : `kit:${order.id}:shipped:${order.trackingCode}`,
      html: `
        <div style="background:#eef7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#102f35">
          <div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #dce9e6;border-radius:22px;overflow:hidden">
            <div style="background:#073b4c;padding:24px 28px;color:#ffffff">
              <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#32e3bc">SAFEKITCHEN SMART</div>
              <h1 style="font-size:26px;margin:10px 0 0">Seu kit está a caminho</h1>
            </div>
            <div style="padding:28px">
              <p style="font-size:16px;line-height:1.65">Olá, <strong>${htmlEscape(order.customerName)}</strong>.</p>
              <p style="font-size:16px;line-height:1.65;color:#425b60">
                O kit <strong>${htmlEscape(plan.name)}</strong> foi despachado e já pode ser acompanhado.
              </p>
              <div style="margin:22px 0;padding:18px;border-radius:16px;background:#f3faf8">
                <p style="margin:0 0 8px"><strong>Código de rastreamento:</strong> ${htmlEscape(order.trackingCode)}</p>
                <p style="margin:0"><strong>Contrato:</strong> ${htmlEscape(order.contract?.contractNumber || 'em processamento')}</p>
              </div>
              ${trackingLink}
              <p style="margin-top:24px;font-size:15px;line-height:1.65;color:#425b60">
                Depois que o kit chegar, entre na tela de assinatura e confirme o recebimento.
                Essa confirmação faz parte da ativação do acesso operacional.
              </p>
              <p style="margin-top:26px;font-size:13px;color:#718487">
                Se houver alguma divergência na entrega, entre em contato com ${htmlEscape(env.contractProviderEmail)}.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return prisma.kitOrder.update({
      where: { id: order.id },
      data: {
        shippingEmailedAt: new Date(),
        shippingEmailProviderId: result.id || null,
        shippingEmailError: null,
      },
      include: { contract: true },
    });
  } catch (error) {
    await prisma.kitOrder.update({
      where: { id: order.id },
      data: {
        shippingEmailError: (error instanceof Error ? error.message : 'Falha no envio').slice(0, 500),
      },
    });
    throw error;
  }
}

export async function markKitShipped(input: {
  orderId: string;
  trackingCode: string;
  trackingUrl?: string;
  forceResend?: boolean;
}) {
  const order = await prisma.kitOrder.findUnique({ where: { id: input.orderId } });
  if (!order) throw new Error('Pedido do kit não encontrado.');
  if (order.status !== 'APPROVED') throw new Error('Somente kits pagos podem ser despachados.');
  if (order.deliveredAt) throw new Error('Este kit já foi marcado como recebido.');

  await prisma.kitOrder.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: 'SHIPPED',
      shippedAt: order.shippedAt || new Date(),
      trackingCode: input.trackingCode,
      trackingUrl: input.trackingUrl || null,
      shippingEmailError: null,
    },
  });

  let emailSent = false;
  try {
    const emailed = await emailKitShipment(order.id, Boolean(input.forceResend));
    emailSent = Boolean(emailed.shippingEmailedAt);
  } catch (error) {
    console.error('Falha ao enviar rastreamento do kit:', error);
  }

  const updated = await prisma.kitOrder.findUnique({
    where: { id: order.id },
    include: { contract: true },
  });
  if (!updated) throw new Error('Pedido do kit não encontrado após o despacho.');

  await createSystemNotification({
    restaurantId: order.restaurantId,
    type: 'KIT_SHIPPED',
    severity: 'INFO',
    title: 'Kit enviado',
    message: emailSent
      ? `O kit foi enviado. Rastreamento: ${input.trackingCode}. Os dados também foram enviados por e-mail.`
      : `O kit foi enviado. Rastreamento: ${input.trackingCode}. O envio do e-mail está pendente.`,
    link: '/assinatura',
    dedupeKey: `kit:${order.id}:shipped:${input.trackingCode}`,
  });

  return updated;
}

export async function confirmKitDelivery(restaurantId: string) {
  const order = await prisma.kitOrder.findFirst({
    where: { restaurantId, status: 'APPROVED' },
    orderBy: { paidAt: 'desc' },
  });

  if (!order) throw new Error('Nenhum kit pago foi encontrado para esta conta.');

  const delivered = order.deliveredAt
    ? order
    : await prisma.kitOrder.update({
        where: { id: order.id },
        data: {
          deliveredAt: new Date(),
          fulfillmentStatus: 'DELIVERED',
        },
      });

  const contract = await activateContractIfEligible(restaurantId);
  await createSystemNotification({
    restaurantId,
    type: 'KIT_DELIVERED',
    severity: 'INFO',
    title: 'Recebimento do kit confirmado',
    message: contract
      ? 'Kit recebido e acesso operacional liberado.'
      : 'Kit recebido. Agora autorize a mensalidade para liberar o sistema.',
    link: '/assinatura',
    dedupeKey: `kit:${order.id}:delivered`,
  });

  return { order: delivered, operationalAccess: Boolean(contract) };
}
