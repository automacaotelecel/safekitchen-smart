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

  const paid = await prisma.implementationOrder.findFirst({
    where: { restaurantId: input.restaurantId, status: 'APPROVED' },
    orderBy: { paidAt: 'desc' },
  });
  if (paid) {
    throw new Error('Esta conta já possui uma taxa de implantação paga.');
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
    pending.contract?.version === env.contractTermsVersion
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
    const response = await new Preference(client()).create({
      body: {
        items: [
          {
            id: `sks-implementation-${plan.code.toLowerCase()}`,
            title: `SafeKitchen Smart - Implantação ${plan.name}`,
            description: plan.implementationItems.join('; ').slice(0, 250),
            quantity: 1,
            unit_price: plan.setupAmountCents / 100,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: input.payerEmail,
          name: input.customerName,
        },
        external_reference: `implementation:${order.id}`,
        back_urls: {
          success: `${baseUrl}/assinatura?implementation=approved`,
          pending: `${baseUrl}/assinatura?implementation=pending`,
          failure: `${baseUrl}/assinatura?implementation=failure`,
        },
        auto_return: 'approved',
        notification_url: `${env.backendUrl}/api/billing/webhooks/mercado-pago`,
        statement_descriptor: 'SAFEKITCHEN',
      },
    });

    if (!response.id || !response.init_point) {
      throw new Error('O Mercado Pago não devolveu o checkout da implantação.');
    }

    return prisma.implementationOrder.update({
      where: { id: order.id },
      data: {
        providerPreferenceId: response.id,
        checkoutUrl: response.init_point,
      },
      include: { contract: true },
    });
  } catch (error) {
    await prisma.implementationOrder.update({
      where: { id: order.id },
      data: { status: 'ERROR' },
    });
    throw error;
  }
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

  const status = paymentStatus(response.status);
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.implementationOrder.update({
      where: { id: order.id },
      data: {
        status,
        providerPaymentId: String(response.id || providerPaymentId),
        paidAt: status === 'APPROVED' ? order.paidAt || new Date() : order.paidAt,
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
        data: { subscriptionStatus: 'PENDING_IMPLEMENTATION' },
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
        ? 'Pagamento confirmado e contrato enviado por e-mail. Nossa equipe fará o agendamento da implantação.'
        : 'Pagamento confirmado. O envio do contrato está pendente e nossa equipe fará o agendamento da implantação.',
      link: '/assinatura',
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
      ? 'Implantação concluída e acesso operacional liberado.'
      : 'Implantação concluída. Agora autorize a mensalidade para liberar o acesso completo.',
    link: '/assinatura',
    dedupeKey: `implementation:${order.id}:completed`,
  });

  return {
    order: completed,
    operationalAccess: Boolean(contract),
  };
}
