import { differenceInCalendarDays } from 'date-fns';

import { env } from '../../config/env';
import { sendAlertEmail } from '../../lib/email';
import { prisma } from '../../lib/prisma';

type AlertCandidate = {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  link: string;
  entity?: string;
  entityId?: string;
  dedupeKey: string;
  preference:
    | 'labelsEnabled'
    | 'documentsEnabled'
    | 'complianceEnabled'
    | 'temperatureEnabled'
    | 'deviceOfflineEnabled';
};

export async function createSystemNotification(input: {
  restaurantId: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  link?: string;
  dedupeKey: string;
}) {
  const users = await recipients(input.restaurantId);
  for (const user of users) {
    const preference = user.notificationPreference;
    if (preference && !preference.inAppEnabled && !preference.emailEnabled) continue;
    await prisma.notification.upsert({
      where: { userId_dedupeKey: { userId: user.id, dedupeKey: input.dedupeKey } },
      create: {
        restaurantId: input.restaurantId,
        userId: user.id,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        link: input.link || '/assinatura',
        entity: 'Subscription',
        dedupeKey: input.dedupeKey,
      },
      update: {
        severity: input.severity,
        title: input.title,
        message: input.message,
        link: input.link || '/assinatura',
      },
    });
  }
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function recipients(restaurantId: string) {
  return prisma.user.findMany({
    where: {
      restaurantId,
      active: true,
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    include: { notificationPreference: true },
  });
}

async function candidatesForRestaurant(restaurantId: string): Promise<AlertCandidate[]> {
  const now = new Date();
  const today = dateKey(now);
  const [labels, documents, controls, readings, devices] = await Promise.all([
    prisma.label.findMany({
      where: {
        restaurantId,
        status: { not: 'CANCELADA' },
        expiresAt: { not: null, lte: new Date(now.getTime() + 7 * 86_400_000) },
      },
      orderBy: { expiresAt: 'asc' },
      take: 300,
    }),
    prisma.document.findMany({
      where: {
        restaurantId,
        status: 'ACTIVE',
        expiresAt: { not: null, lte: new Date(now.getTime() + 365 * 86_400_000) },
      },
      orderBy: { expiresAt: 'asc' },
      take: 500,
    }),
    prisma.complianceRecord.findMany({
      where: {
        restaurantId,
        status: 'ACTIVE',
        nextDueAt: { not: null, lte: new Date(now.getTime() + 365 * 86_400_000) },
      },
      orderBy: { nextDueAt: 'asc' },
      take: 500,
    }),
    prisma.temperatureReading.findMany({
      where: {
        restaurantId,
        status: 'ALERT',
        occurredAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    }),
    prisma.temperatureDevice.findMany({
      where: { restaurantId, active: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);

  const candidates: AlertCandidate[] = [];
  const expiringLabels = labels.filter((label) => label.expiresAt && label.expiresAt >= now);
  const expiredLabels = labels.filter((label) => label.expiresAt && label.expiresAt < now);

  if (expiringLabels.length) {
    candidates.push({
      type: 'LABEL_EXPIRING',
      severity: 'WARNING',
      title: `${expiringLabels.length} etiqueta(s) perto do vencimento`,
      message: `Existem ${expiringLabels.length} produtos com validade nos próximos 7 dias.`,
      link: '/historico?status=VENCENDO',
      entity: 'Label',
      dedupeKey: `labels:expiring:${today}`,
      preference: 'labelsEnabled',
    });
  }
  if (expiredLabels.length) {
    candidates.push({
      type: 'LABEL_EXPIRED',
      severity: 'CRITICAL',
      title: `${expiredLabels.length} etiqueta(s) vencida(s)`,
      message: 'Revise imediatamente os produtos vencidos e registre a ação tomada.',
      link: '/historico?status=VENCIDAS',
      entity: 'Label',
      dedupeKey: `labels:expired:${today}`,
      preference: 'labelsEnabled',
    });
  }

  for (const document of documents) {
    if (!document.expiresAt) continue;
    const days = differenceInCalendarDays(document.expiresAt, now);
    if (days > document.reminderDays) continue;
    const expired = days < 0;
    candidates.push({
      type: expired ? 'DOCUMENT_EXPIRED' : 'DOCUMENT_EXPIRING',
      severity: expired ? 'CRITICAL' : 'WARNING',
      title: expired ? 'Documento vencido' : 'Documento próximo do vencimento',
      message: `${document.name} ${expired ? `venceu há ${Math.abs(days)} dia(s)` : `vence em ${days} dia(s)`}.`,
      link: '/documentos',
      entity: 'Document',
      entityId: document.id,
      dedupeKey: `document:${document.id}:${expired ? 'expired' : 'due'}:${dateKey(document.expiresAt)}`,
      preference: 'documentsEnabled',
    });
  }

  for (const control of controls) {
    if (!control.nextDueAt) continue;
    const days = differenceInCalendarDays(control.nextDueAt, now);
    if (days > 30) continue;
    const overdue = days < 0;
    candidates.push({
      type: overdue ? 'COMPLIANCE_OVERDUE' : 'COMPLIANCE_DUE',
      severity: overdue ? 'CRITICAL' : 'WARNING',
      title: overdue ? 'Controle sanitário atrasado' : 'Controle sanitário próximo',
      message: `${control.subject} ${overdue ? `está atrasado há ${Math.abs(days)} dia(s)` : `vence em ${days} dia(s)`}.`,
      link: '/controles',
      entity: 'ComplianceRecord',
      entityId: control.id,
      dedupeKey: `compliance:${control.id}:${overdue ? 'overdue' : 'due'}:${dateKey(control.nextDueAt)}`,
      preference: 'complianceEnabled',
    });
  }

  for (const reading of readings) {
    candidates.push({
      type: 'TEMPERATURE_ALERT',
      severity: 'CRITICAL',
      title: 'Temperatura fora do limite',
      message: `${reading.subject}: ${reading.temperatureC.toFixed(1)} °C em ${reading.occurredAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
      link: '/temperaturas',
      entity: 'TemperatureReading',
      entityId: reading.id,
      dedupeKey: `temperature:${reading.id}`,
      preference: 'temperatureEnabled',
    });
  }

  const offlineBefore = new Date(now.getTime() - env.deviceOfflineMinutes * 60_000);
  for (const device of devices) {
    const reference = device.lastSeenAt || device.createdAt;
    if (reference > offlineBefore) continue;
    candidates.push({
      type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      title: 'Dispositivo de temperatura offline',
      message: `${device.name} não envia leituras há mais de ${env.deviceOfflineMinutes} minutos.`,
      link: '/temperaturas',
      entity: 'TemperatureDevice',
      entityId: device.id,
      dedupeKey: `device:${device.id}:offline:${today}`,
      preference: 'deviceOfflineEnabled',
    });
  }

  return candidates;
}

export async function generateAlertsForRestaurant(restaurantId: string) {
  const [users, candidates] = await Promise.all([
    recipients(restaurantId),
    candidatesForRestaurant(restaurantId),
  ]);
  let created = 0;

  for (const user of users) {
    const preference = user.notificationPreference;
    for (const candidate of candidates) {
      if (preference && !preference[candidate.preference]) continue;
      if (preference && !preference.inAppEnabled && !preference.emailEnabled) continue;

      const result = await prisma.notification.upsert({
        where: {
          userId_dedupeKey: { userId: user.id, dedupeKey: candidate.dedupeKey },
        },
        create: {
          restaurantId,
          userId: user.id,
          type: candidate.type,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          link: candidate.link,
          entity: candidate.entity,
          entityId: candidate.entityId,
          dedupeKey: candidate.dedupeKey,
        },
        update: {
          title: candidate.title,
          message: candidate.message,
          severity: candidate.severity,
          link: candidate.link,
        },
        select: { createdAt: true, updatedAt: true },
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
    }
  }

  return { candidates: candidates.length, created };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchPendingEmails(restaurantId?: string) {
  if (!env.emailEnabled) return { sent: 0, failed: 0, skipped: true };

  const notifications = await prisma.notification.findMany({
    where: {
      ...(restaurantId ? { restaurantId } : {}),
      emailSentAt: null,
      emailAttempts: { lt: 3 },
      user: {
        active: true,
        OR: [
          { notificationPreference: null },
          { notificationPreference: { emailEnabled: true } },
        ],
      },
    },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  let sent = 0;
  let failed = 0;
  for (const notification of notifications) {
    try {
      await sendAlertEmail({
        to: notification.user.email,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        idempotencyKey: `notification-${notification.id}`,
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSentAt: new Date(), emailAttempts: { increment: 1 }, emailError: null },
      });
      sent += 1;
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailAttempts: { increment: 1 },
          emailError: (error instanceof Error ? error.message : 'Falha no envio').slice(0, 500),
        },
      });
      failed += 1;
    }
    await wait(550);
  }

  return { sent, failed, skipped: false };
}

export async function runAlertCycle() {
  const now = new Date();
  const restaurants = await prisma.restaurant.findMany({
    where: {
      active: true,
      OR: [
        { subscriptionStatus: 'ACTIVE' },
        { subscriptionStatus: 'PAST_DUE', subscriptionEndsAt: { gte: now } },
        { subscriptionStatus: 'TRIALING', trialEndsAt: { gte: now } },
      ],
    },
    select: { id: true },
    take: 500,
  });

  let created = 0;
  for (const restaurant of restaurants) {
    const result = await generateAlertsForRestaurant(restaurant.id);
    created += result.created;
  }
  const email = await dispatchPendingEmails();
  return { restaurants: restaurants.length, created, email, finishedAt: new Date() };
}
