import { createHash, randomUUID } from 'crypto';

import type { CommercialContract, Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';

import { env } from '../../config/env';
import { sendEmail } from '../../lib/email';
import { prisma } from '../../lib/prisma';
import { createSystemNotification } from '../notifications/notifications.service';
import { getCommercialPlan } from './plans';

type DeliveryAddress = {
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
};

export type ContractSnapshot = {
  provider: { name: string; document: string; address: string; email: string; city: string };
  customer: { name: string; email: string; document: string; phone?: string; address: DeliveryAddress };
  plan: {
    code: string;
    name: string;
    setupAmountCents: number;
    monthlyAmountCents: number;
    kitItems: string[];
    features: string[];
  };
  acceptedAt: string;
  deliveryDays: number;
  version: string;
};

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatAddress(address: DeliveryAddress) {
  return `${address.street}, ${address.number}${address.complement ? `, ${address.complement}` : ''} - ${address.district}, ${address.city}/${address.state}, CEP ${address.postalCode}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createContractSnapshot(input: {
  customerName: string;
  customerEmail: string;
  customerDocument: string;
  customerPhone?: string;
  deliveryAddress: DeliveryAddress;
  planCode: string;
  acceptedAt: Date;
}): ContractSnapshot {
  if (!env.contractProviderConfigured) {
    throw new Error('Configure os dados jurídicos do contrato no Render antes de vender kits.');
  }
  const plan = getCommercialPlan(input.planCode);
  if (!plan) throw new Error('Plano comercial inválido.');

  return {
    provider: {
      name: env.contractProviderName,
      document: env.contractProviderDocument,
      address: env.contractProviderAddress,
      email: env.contractProviderEmail,
      city: env.contractCity,
    },
    customer: {
      name: input.customerName,
      email: input.customerEmail,
      document: input.customerDocument,
      phone: input.customerPhone,
      address: input.deliveryAddress,
    },
    plan: {
      code: plan.code,
      name: plan.name,
      setupAmountCents: plan.setupAmountCents,
      monthlyAmountCents: plan.amountCents,
      kitItems: plan.kitItems,
      features: plan.features,
    },
    acceptedAt: input.acceptedAt.toISOString(),
    deliveryDays: env.contractDeliveryDays,
    version: env.contractTermsVersion,
  };
}

export function contractHash(snapshot: ContractSnapshot) {
  return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

export function newContractNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SKS-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function snapshotFrom(contract: CommercialContract): ContractSnapshot {
  return contract.termsSnapshot as unknown as ContractSnapshot;
}

export async function renderContractPdf(contract: CommercialContract) {
  const snapshot = snapshotFrom(contract);
  const doc = new PDFDocument({ size: 'A4', margins: { top: 46, bottom: 46, left: 52, right: 52 } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const heading = (title: string) => {
    doc.moveDown(0.7).font('Helvetica-Bold').fontSize(11).fillColor('#10343a').text(title);
    doc.moveDown(0.25).font('Helvetica').fontSize(9.5).fillColor('#243f44');
  };
  const paragraph = (value: string) => doc.text(value, { align: 'justify', lineGap: 2 }).moveDown(0.45);

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#087f70').text('SAFEKITCHEN SMART', { align: 'center' });
  doc.fontSize(12).fillColor('#102f35').text('CONTRATO DE FORNECIMENTO DE KIT E LICENÇA DE USO DE SOFTWARE', { align: 'center' });
  doc.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#52666a').text(`Contrato nº ${contract.contractNumber} · Versão ${contract.version}`, { align: 'center' });

  heading('1. PARTES');
  paragraph(`CONTRATADA: ${snapshot.provider.name}, documento ${snapshot.provider.document}, com endereço em ${snapshot.provider.address}, e-mail ${snapshot.provider.email}.`);
  paragraph(`CONTRATANTE: ${snapshot.customer.name}, documento ${snapshot.customer.document}, e-mail ${snapshot.customer.email}${snapshot.customer.phone ? `, telefone ${snapshot.customer.phone}` : ''}, endereço de entrega ${formatAddress(snapshot.customer.address)}.`);

  heading('2. OBJETO');
  paragraph(`Este contrato tem por objeto o fornecimento do kit ${snapshot.plan.name}, sua implantação e a licença mensal, pessoal, limitada, revogável e não transferível de uso do SafeKitchen Smart. O software auxilia controles operacionais e não substitui a responsabilidade técnica, sanitária ou legal do estabelecimento.`);
  paragraph(`Itens do kit: ${snapshot.plan.kitItems.join('; ')}. Recursos digitais principais: ${snapshot.plan.features.join('; ')}.`);

  heading('3. PREÇO E PAGAMENTO');
  paragraph(`O CONTRATANTE pagará ${money(snapshot.plan.setupAmountCents)} pelo kit e implantação, em cobrança única, e ${money(snapshot.plan.monthlyAmountCents)} por mês pela licença e serviços digitais. A mensalidade será cobrada pelo Mercado Pago conforme autorização do CONTRATANTE. Tarifas de internet, etiquetas adicionais, equipamentos extras e integrações não descritas acima não estão incluídas.`);

  heading('4. ATIVAÇÃO, ENTREGA E IMPLANTAÇÃO');
  paragraph(`O acesso operacional será liberado após a confirmação do pagamento do kit, da autorização da mensalidade e do recebimento dos equipamentos pelo CONTRATANTE. O prazo estimado de despacho é de até ${snapshot.deliveryDays} dias úteis, contado da confirmação dos dados e do pagamento, salvo indisponibilidade comunicada ao CONTRATANTE. O CONTRATANTE deverá conferir os itens recebidos e comunicar divergências sem demora indevida.`);

  heading('5. VIGÊNCIA, RENOVAÇÃO E CANCELAMENTO');
  paragraph('A licença mensal vigorará por prazo indeterminado, com renovação automática a cada mês. O CONTRATANTE poderá solicitar cancelamento pelos canais disponibilizados. O cancelamento interrompe cobranças futuras, sem apagar obrigações vencidas. A devolução do kit e eventual reembolso observarão a legislação aplicável, inclusive o direito de arrependimento quando cabível, o estado dos produtos e os custos já efetivamente prestados permitidos por lei.');

  heading('6. EQUIPAMENTOS E GARANTIA');
  paragraph('Os equipamentos devem ser usados conforme os manuais dos fabricantes. Defeitos serão tratados conforme a garantia legal e, quando existente, a garantia do fabricante. Danos por queda, líquido, instalação inadequada, violação, uso incompatível ou desgaste de consumíveis não são cobertos além do exigido pela legislação aplicável.');

  heading('7. SOFTWARE, DISPONIBILIDADE E RESPONSABILIDADES');
  paragraph('A CONTRATADA realizará esforços razoáveis para manter o serviço disponível, podendo efetuar manutenções e atualizações. O CONTRATANTE é responsável por usuários, senhas, conexão, cadastros, conferência de etiquetas, medições, validades e decisões operacionais. Resultados de inteligência artificial devem ser conferidos por pessoa habilitada antes do uso.');

  heading('8. DADOS PESSOAIS E SEGURANÇA');
  paragraph('As partes tratarão dados pessoais apenas para executar este contrato, prestar suporte, processar pagamentos, emitir alertas e cumprir obrigações legais, observando a legislação aplicável. O CONTRATANTE declara possuir base legal para inserir dados de empregados e terceiros no sistema e deverá controlar os acessos de sua equipe.');

  heading('9. ACEITE ELETRÔNICO E PROVA');
  paragraph(`O aceite eletrônico foi registrado em ${new Date(snapshot.acceptedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, vinculado ao e-mail ${snapshot.customer.email}. Para rastreabilidade, o sistema registra versão, data, usuário, endereço IP, agente do navegador e hash SHA-256 do conteúdo. Hash: ${contract.contentHash}.`);

  heading('10. DISPOSIÇÕES GERAIS');
  paragraph('Comunicações poderão ser realizadas pelos e-mails informados. A eventual nulidade de uma cláusula não invalida as demais. Aplicam-se as leis brasileiras e os direitos inderrogáveis do consumidor, quando caracterizada relação de consumo. Fica preservado o foro legalmente competente, inclusive o domicílio do consumidor quando aplicável. Recomenda-se que as partes guardem este PDF e os comprovantes de pagamento.');

  doc.moveDown(1).font('Helvetica-Bold').fontSize(9.5).text(`${snapshot.provider.city}, ${new Date(snapshot.acceptedAt).toLocaleDateString('pt-BR')}.`, { align: 'center' });
  doc.moveDown(1.5).font('Helvetica').text(`CONTRATADA: ${snapshot.provider.name}`, { align: 'center' });
  doc.moveDown(0.5).text(`CONTRATANTE: ${snapshot.customer.name}`, { align: 'center' });
  doc.moveDown(0.7).fontSize(8).fillColor('#6b7d80').text('Aceite realizado eletronicamente. Documento gerado automaticamente pelo SafeKitchen Smart.', { align: 'center' });

  doc.end();
  return completed;
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);
}

export async function emailContract(contractId: string, forceResend = false) {
  const contract = await prisma.commercialContract.findUnique({ where: { id: contractId } });
  if (!contract) throw new Error('Contrato não encontrado.');
  if (contract.status !== 'ACTIVE') throw new Error('O contrato ainda não está ativo.');
  if (contract.emailedAt && !forceResend) return contract;

  const pdf = await renderContractPdf(contract);
  try {
    const result = await sendEmail({
      to: contract.customerEmail,
      subject: `Contrato ${contract.contractNumber} — SafeKitchen Smart`,
      idempotencyKey: forceResend
        ? `contract:${contract.id}:resend:${Date.now()}`
        : `contract:${contract.id}:v${contract.version}`,
      attachments: [{ filename: `${contract.contractNumber}.pdf`, content: pdf.toString('base64') }],
      html: `<div style="font-family:Arial,sans-serif;background:#f4f8f7;padding:32px;color:#102f35"><div style="max-width:620px;margin:auto;background:#fff;border-radius:18px;padding:28px"><strong style="color:#087f70">SAFEKITCHEN SMART</strong><h1>Contratação confirmada</h1><p>Olá, ${htmlEscape(contract.customerName)}.</p><p>O pagamento, a assinatura do plano e o recebimento do kit foram confirmados. O contrato nº <strong>${htmlEscape(contract.contractNumber)}</strong> está anexado em PDF e o acesso operacional foi liberado.</p><p>Guarde este documento e os comprovantes de pagamento.</p></div></div>`,
    });
    return prisma.commercialContract.update({
      where: { id: contract.id },
      data: { emailedAt: new Date(), emailProviderId: result.id || null, emailError: null },
    });
  } catch (error) {
    await prisma.commercialContract.update({
      where: { id: contract.id },
      data: { emailError: (error instanceof Error ? error.message : 'Falha no envio').slice(0, 500) },
    });
    throw error;
  }
}

export async function activateContractIfEligible(restaurantId: string) {
  const [kitOrder, subscription] = await Promise.all([
    prisma.kitOrder.findFirst({
      where: { restaurantId, status: 'APPROVED' },
      orderBy: { paidAt: 'desc' },
      include: { contract: true },
    }),
    prisma.subscription.findUnique({ where: { restaurantId } }),
  ]);
  if (!kitOrder?.contract || !kitOrder.deliveredAt || subscription?.status !== 'ACTIVE') {
    return null;
  }

  const plan = getCommercialPlan(subscription.planCode);
  if (!plan || plan.code !== kitOrder.planCode) return null;

  const contract = await prisma.$transaction(async (tx) => {
    await tx.restaurant.update({
      where: { id: restaurantId },
      data: {
        plan: plan.code,
        maxUsers: plan.maxUsers,
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: null,
      },
    });
    return tx.commercialContract.update({
      where: { id: kitOrder.contract!.id },
      data: { status: 'ACTIVE', activatedAt: kitOrder.contract!.activatedAt || new Date() },
    });
  });

  let emailSent = Boolean(contract.emailedAt);
  if (!contract.emailedAt) {
    try {
      const emailed = await emailContract(contract.id);
      emailSent = Boolean(emailed.emailedAt);
    } catch (error) {
      console.error('Falha ao enviar contrato:', error);
    }
  }

  await createSystemNotification({
    restaurantId,
    type: 'CONTRACT_ACTIVE',
    severity: 'INFO',
    title: 'Contratação concluída',
    message: emailSent
      ? `O contrato ${contract.contractNumber} está ativo e foi enviado para ${contract.customerEmail}.`
      : `O contrato ${contract.contractNumber} está ativo. O envio por e-mail está pendente e pode ser repetido nesta tela.`,
    link: '/assinatura',
    dedupeKey: `contract:${contract.id}:active`,
  });
  return contract;
}

export type ContractSnapshotJson = Prisma.InputJsonValue;
