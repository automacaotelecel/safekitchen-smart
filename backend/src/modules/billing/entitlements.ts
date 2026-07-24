import { startOfMonth } from 'date-fns';

import { prisma } from '../../lib/prisma';
import { planForAccess } from './plans';

export async function accountEntitlements(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { plan: true },
  });
  if (!restaurant) throw new Error('Conta não encontrada.');
  return planForAccess(restaurant.plan);
}

export async function assertLabelQuota(restaurantId: string) {
  const plan = await accountEntitlements(restaurantId);
  if (plan.maxLabelsPerMonth === null) return plan;

  const used = await prisma.label.count({
    where: { restaurantId, createdAt: { gte: startOfMonth(new Date()) } },
  });
  if (used >= plan.maxLabelsPerMonth) {
    throw new Error(`Limite mensal de ${plan.maxLabelsPerMonth} etiquetas atingido.`);
  }
  return plan;
}

export async function assertAiQuota(restaurantId: string) {
  const plan = await accountEntitlements(restaurantId);
  const used = await prisma.aiUsage.count({
    where: {
      restaurantId,
      feature: 'PRODUCT_VISION',
      createdAt: { gte: startOfMonth(new Date()) },
    },
  });
  if (used >= plan.maxAiAnalysesPerMonth) {
    throw new Error(`Limite mensal de ${plan.maxAiAnalysesPerMonth} análises da Sana atingido.`);
  }
  return plan;
}

export async function assertDeviceQuota(restaurantId: string) {
  const plan = await accountEntitlements(restaurantId);
  const used = await prisma.temperatureDevice.count({
    where: { restaurantId, active: true },
  });
  if (used >= plan.maxDevices) {
    throw new Error(`Limite de ${plan.maxDevices} dispositivo(s) do plano atingido.`);
  }
  return plan;
}
