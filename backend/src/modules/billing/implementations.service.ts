import type { Prisma } from '@prisma/client';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';

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

type BusinessAddress = {
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
};

export type ImplementationCheckoutInput = {
  restaurantId: string;
  userId: string;
  payerEmail: string;
  planCode: PlanCode;
  customerName: string;
  customerDocument: string;
  customerPhone?: string;
  businessAddress: BusinessAddress;
  acceptedIp?: string;
  acceptedUserAgent?: string;
};

export type ScheduleImplementationInput = {
  orderId: string;
  scheduledFor: Date;
  meetingUrl?: string;
  notes?: string;
  forceResend?: boolean;
};

function client() {
  if (!env.mercadoPagoAccessToken) {
    throw new Error('Mercado Pago não configurado no servidor.');
  }
  return new MercadoPagoConfig({
    accessToken: env.mercadoPagoAccessToken,
    options: { timeout: 15_000 },
  });
}

function htmlEscape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!
  );
}

function paymentStatus(status?: string) {
  if (status === 'approved') return 'APPROVED';
  if (status === 'rejected') return 'REJECTED';
  if (status === 'refunded') return 'REFUNDED';
  if (status === 'cancelled') return 'CANCELED';
  return 'PENDING';
}

function formatSchedule(value: Date) {
  return value.toLocaleString('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

export async function createImplementationCheckout(input: ImplementationCheckoutInput) {
  const plan = getCommercialPlan(input.planCode);
  if (!plan) throw new Error('Plano inválido.');

  const [paid, currentSubscription] = await Promise.all([
    prisma.implementationOrder.findFirst({
      where: { restaurantId: input.restaurantId, status: 'APPROVED' },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.subscription.findUnique({
      where: { restaurantId: input.restaurantId },
    }),
  ]);
  if (paid) {
    throw new Error('Esta conta já possui uma taxa de implantação paga.');
  }
  if (
    currentSubscription?.status === 'ACTIVE' &&
    currentSubscription.providerSubscriptionId
  ) {
    throw new Error('Esta conta já possui uma assinatura ativa.');
  }

  const pending = await prisma.implementationOrder.findFirst({
    where: {
      restaurantId: input.restaurantId,
      status: 'PENDING',
      planCode: plan.code,
    },
    orderBy: { createdAt: 'desc' },
    include: { contract: true },
  });
  if (
    pending?.checkoutUrl &&
    pending.contract?.version === env.contractTermsVersion &&
    currentSubscription?.providerSubscriptionId ===
      pending.providerPreferenceId
  ) {
    return pending;
  }

  const acceptedAt = new Date();
  const snapshot = createContractSnapshot({
    customerName: input.customerName,
    customerEmail: input.payerEmail,
    customerDocument: input.customerDocument,
    customerPhone: input.customerPhone,
    businessAddress: input.businessAddress,
    planCode: plan.code,
    acceptedAt,
  });

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.implementationOrder.create({
      data: {
        restaurantId: input.restaurantId,
        planCode: plan.code,
        amountCents: plan.setupAmountCents,
        payerEmail: input.payerEmail,
        customerName: input.customerName,
        customerDocument: input.customerDocument,
        customerPhone: input.customerPhone || null,
        businessAddress: input.businessAddress as Prisma.InputJsonValue,
      },
    });

    await tx.commercialContract.create({
      data: {
        restaurantId: input.restaurantId,
        implementationOrderId: created.id,
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
    const response = await new PreApproval(client()).create({
      body: {
        reason: `SafeKitchen Smart - Implantação e licença ${plan.name}`,
        external_reference: `${input.restaurantId}:${plan.code}`,
        payer_email: input.payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.setupAmountCents / 100,
          currency_id: 'BRL',
        },
        back_url: `${baseUrl}/assinatura?checkout=retorno`,
        status: 'pending',
        notification_url: `${env.backendUrl}/api/billing/webhooks/mercado-pago`,
      } as never,
    });

    if (!response.id || !response.init_point) {
      throw new Error('O Mercado Pago não devolveu o link da contratação.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.subscription.upsert({
        where: { restaurantId: input.restaurantId },
        create: {
          restaurantId: input.restaurantId,
          planCode: plan.code,
          status: 'PENDING',
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
          status: 'PENDING',
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

      return tx.implementationOrder.update({
        where: { id: order.id },
        data: {
          providerPreferenceId: response.id,
          checkoutUrl: response.init_point,
        },
        include: { contract: true },
      });
    });
  } catch (error) {
    await prisma.implementationOrder.update({
      where: { id: order.id },
      data: { status: 'ERROR' },
    });
    throw error;
  }
}

export async function confirmImplementationFromSubscription(input: {
  restaurantId: string;
  planCode: PlanCode;
  providerSubscriptionId: string;
  providerPaymentId?: string | null;
}) {
  const order = await prisma.implementationOrder.findFirst({
    where: {
      restaurantId: input.restaurantId,
      planCode: input.planCode,
      OR: [
        { providerPreferenceId: input.providerSubscriptionId },
        { status: 'APPROVED' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { contract: true },
  });
  if (!order) {
    throw new Error('Contrato de implantação não encontrado para esta assinatura.');
  }

  const newlyApproved = order.status !== 'APPROVED';
  const approvedAt = order.paidAt || new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.implementationOrder.update({
      where: { id: order.id },
      data: {
        status: 'APPROVED',
        providerPaymentId:
          input.providerPaymentId || order.providerPaymentId,
        paidAt: approvedAt,
        implementationStatus:
          order.implementationStatus === 'AWAITING_PAYMENT'
            ? 'AWAITING_SCHEDULING'
            : order.implementationStatus,
      },
      include: { contract: true },
    });

    if (saved.contract && saved.contract.status !== 'ACTIVE') {
      await tx.commercialContract.update({
        where: { id: saved.contract.id },
        data: { status: 'IMPLEMENTATION_PAID_PENDING_ACTIVATION' },
      });
    }
    return saved;
  });

  if (newlyApproved) {
    await createSystemNotification({
      restaurantId: order.restaurantId,
      type: 'IMPLEMENTATION_PAYMENT_APPROVED',
      severity: 'INFO',
      title: 'Contratação confirmada',
      message:
        'A taxa de implantação foi confirmada, a mensalidade ficou autorizada e o acesso ao sistema foi liberado.',
      link: '/painel',
      dedupeKey: `implementation:${order.id}:subscription-approved`,
    });
  }

  return updated;
}

export async function syncImplementationPayment(providerPaymentId: string) {
  const response = await new Payment(client()).get({ id: providerPaymentId });
  const reference = String(response.external_reference || '');
  if (!reference.startsWith('implementation:')) {
    throw new Error('Pagamento sem referência de implantação válida.');
  }

  const orderId = reference.slice('implementation:'.length);
  const order = await prisma.implementationOrder.findUnique({
    where: { id: orderId },
    include: { contract: true },
  });
  if (!order) throw new Error('Contratação de implantação não encontrada.');
  const plan = getCommercialPlan(order.planCode);
  if (!plan) throw new Error('Plano de implantação não encontrado.');

  const status = paymentStatus(response.status);
  const approvedAt = order.paidAt || new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.implementationOrder.update({
      where: { id: order.id },
      data: {
        status,
        providerPaymentId: String(response.id || providerPaymentId),
        paidAt: status === 'APPROVED' ? approvedAt : order.paidAt,
        implementationStatus:
          status === 'APPROVED'
            ? 'AWAITING_SCHEDULING'
            : order.implementationStatus,
      },
      include: { contract: true },
    });

    if (status === 'APPROVED') {
      await tx.commercialContract.update({
        where: { implementationOrderId: order.id },
        data: { status: 'IMPLEMENTATION_PAID_PENDING_ACTIVATION' },
      });
      await tx.restaurant.update({
        where: { id: order.restaurantId },
        data: {
          plan: plan.code,
          maxUsers: plan.maxUsers,
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt: null,
        },
      });
    }
    return saved;
  });

  if (status === 'APPROVED') {
    let contractSent = false;
    if (updated.contract) {
      try {
        const sent = await emailContract(updated.contract.id);
        contractSent = Boolean(sent.emailedAt);
      } catch (error) {
        console.error('Falha ao enviar confirmação da implantação:', error);
      }
    }

    await createSystemNotification({
      restaurantId: order.restaurantId,
      type: 'IMPLEMENTATION_PAYMENT_APPROVED',
      severity: 'INFO',
      title: 'Taxa de implantação confirmada',
      message: contractSent
        ? 'Pagamento confirmado, acesso liberado e contrato enviado por e-mail.'
        : 'Pagamento confirmado e acesso liberado. O envio do contrato está pendente.',
      link: '/painel',
      dedupeKey: `implementation:${order.id}:approved`,
    });
  }

  const finalOrder = await prisma.implementationOrder.findUnique({
    where: { id: order.id },
    include: { contract: true },
  });
  if (!finalOrder) {
    throw new Error('Implantação não encontrada após a atualização do pagamento.');
  }
  return finalOrder;
}

async function emailImplementationSchedule(
  orderId: string,
  forceResend = false
) {
  const order = await prisma.implementationOrder.findUnique({
    where: { id: orderId },
    include: { contract: true },
  });
  if (!order) throw new Error('Contratação de implantação não encontrada.');
  if (order.status !== 'APPROVED') {
    throw new Error('A taxa de implantação ainda não está paga.');
  }
  if (!order.scheduledFor) {
    throw new Error('A data da implantação ainda não foi informada.');
  }
  if (order.scheduleEmailedAt && !forceResend) return order;

  const plan = getCommercialPlan(order.planCode);
  if (!plan) throw new Error('Plano de implantação não encontrado.');

  const accessButton = order.meetingUrl
    ? `<a href="${htmlEscape(order.meetingUrl)}" style="display:inline-block;margin-top:16px;background:#19d09c;color:#073b4c;text-decoration:none;padding:13px 20px;border-radius:13px;font-weight:800">Acessar implantação</a>`
    : '';

  try {
    const result = await sendEmail({
      to: order.payerEmail,
      subject: `Implantação agendada — ${plan.name}`,
      idempotencyKey: forceResend
        ? `implementation:${order.id}:scheduled:resend:${Date.now()}`
        : `implementation:${order.id}:scheduled:${order.scheduledFor.toISOString()}`,
      html: `
        <div style="background:#eef7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#102f35">
          <div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #dce9e6;border-radius:22px;overflow:hidden">
            <div style="background:#073b4c;padding:24px 28px;color:#ffffff">
              <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#32e3bc">SAFEKITCHEN SMART</div>
              <h1 style="font-size:26px;margin:10px 0 0">Sua implantação foi agendada</h1>
            </div>
            <div style="padding:28px">
              <p style="font-size:16px;line-height:1.65">Olá, <strong>${htmlEscape(order.customerName)}</strong>.</p>
              <p style="font-size:16px;line-height:1.65;color:#425b60">
                A implantação do plano <strong>${htmlEscape(plan.name)}</strong> está confirmada.
              </p>
              <div style="margin:22px 0;padding:18px;border-radius:16px;background:#f3faf8">
                <p style="margin:0 0 8px"><strong>Data e horário:</strong> ${htmlEscape(formatSchedule(order.scheduledFor))}</p>
                <p style="margin:0"><strong>Formato:</strong> atendimento remoto assistido</p>
              </div>
              ${order.scheduleNotes ? `<p style="line-height:1.65;color:#425b60"><strong>Orientações:</strong> ${htmlEscape(order.scheduleNotes)}</p>` : ''}
              ${accessButton}
              <h2 style="font-size:18px;margin:28px 0 10px">Prepare-se para o atendimento</h2>
              <ul style="padding-left:22px;line-height:1.7;color:#425b60">
                <li>Tenha em mãos os dados do estabelecimento e da equipe.</li>
                <li>Garanta acesso à internet e a um computador compatível.</li>
                <li>Separe as informações de produtos, validades e pontos de temperatura.</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    });

    return prisma.implementationOrder.update({
      where: { id: order.id },
      data: {
        scheduleEmailedAt: new Date(),
        scheduleEmailProviderId: result.id || null,
        scheduleEmailError: null,
      },
      include: { contract: true },
    });
  } catch (error) {
    await prisma.implementationOrder.update({
      where: { id: order.id },
      data: {
        scheduleEmailError: (
          error instanceof Error ? error.message : 'Falha no envio'
        ).slice(0, 500),
      },
    });
    throw error;
  }
}

export async function scheduleImplementation(input: ScheduleImplementationInput) {
  const order = await prisma.implementationOrder.findUnique({
    where: { id: input.orderId },
  });
  if (!order) throw new Error('Contratação de implantação não encontrada.');
  if (order.status !== 'APPROVED') {
    throw new Error('A taxa de implantação ainda não está paga.');
  }
  if (order.completedAt) {
    throw new Error('Esta implantação já foi concluída.');
  }

  await prisma.implementationOrder.update({
    where: { id: order.id },
    data: {
      implementationStatus: 'SCHEDULED',
      scheduledAt: new Date(),
      scheduledFor: input.scheduledFor,
      meetingUrl: input.meetingUrl || null,
      scheduleNotes: input.notes || null,
      scheduleEmailedAt: null,
      scheduleEmailProviderId: null,
      scheduleEmailError: null,
    },
  });

  let emailSent = false;
  try {
    const emailed = await emailImplementationSchedule(
      order.id,
      input.forceResend
    );
    emailSent = Boolean(emailed.scheduleEmailedAt);
  } catch (error) {
    console.error('Falha ao enviar agendamento da implantação:', error);
  }

  const updated = await prisma.implementationOrder.findUnique({
    where: { id: order.id },
    include: { contract: true },
  });
  if (!updated) {
    throw new Error('Implantação não encontrada após o agendamento.');
  }

  await createSystemNotification({
    restaurantId: order.restaurantId,
    type: 'IMPLEMENTATION_SCHEDULED',
    severity: 'INFO',
    title: 'Implantação agendada',
    message: emailSent
      ? `Atendimento agendado para ${formatSchedule(input.scheduledFor)}. A confirmação também foi enviada por e-mail.`
      : `Atendimento agendado para ${formatSchedule(input.scheduledFor)}. O envio do e-mail está pendente.`,
    link: '/assinatura',
    dedupeKey: `implementation:${order.id}:scheduled:${input.scheduledFor.toISOString()}`,
  });

  return updated;
}

export async function completeImplementation(orderId: string) {
  const order = await prisma.implementationOrder.findUnique({
    where: { id: orderId },
  });
  if (!order) throw new Error('Contratação de implantação não encontrada.');
  if (order.status !== 'APPROVED') {
    throw new Error('A taxa de implantação ainda não está paga.');
  }

  const completed = order.completedAt
    ? order
    : await prisma.implementationOrder.update({
        where: { id: order.id },
        data: {
          implementationStatus: 'COMPLETED',
          completedAt: new Date(),
        },
      });

  const contract = await activateContractIfEligible(order.restaurantId);
  await createSystemNotification({
    restaurantId: order.restaurantId,
    type: 'IMPLEMENTATION_COMPLETED',
    severity: 'INFO',
    title: 'Implantação concluída',
    message: contract
      ? 'Implantação concluída. Seu acesso e sua licença mensal estão ativos.'
      : 'Implantação concluída. A equipe foi avisada para revisar o estado da sua contratação.',
    link: '/assinatura',
    dedupeKey: `implementation:${order.id}:completed`,
  });

  return {
    order: completed,
    operationalAccess: Boolean(contract),
  };
}
