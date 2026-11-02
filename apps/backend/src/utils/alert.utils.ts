import { PrismaClient } from '@prisma/client';
import { getPeriodBoundaries, calculateBudgetUsage, BudgetPeriod } from './budget.utils.js';

export const evaluateBudgetThresholds = async (
  prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  userId: string
): Promise<Array<{ title: string; type: string }>> => {
  const generatedAlerts: Array<{ title: string; type: string }> = [];

  const budgets = await prisma.budget.findMany({
    where: { userId, isActive: true },
    include: {
      categories: {
        include: { category: true },
      },
    },
  });

  if (budgets.length === 0) return generatedAlerts;

  const now = new Date();

  for (const budget of budgets) {
    const boundaries = getPeriodBoundaries(budget.period as BudgetPeriod, now);

    // Sum settled expenses in this period
    const expenses = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        status: 'SETTLED',
        date: {
          gte: boundaries.startDate,
          lte: boundaries.endDate,
        },
      },
      select: {
        amountPaise: true,
        categoryId: true,
      },
    });

    const totalSpentPaise = expenses.reduce((sum, tx) => sum + BigInt(tx.amountPaise), 0n);
    const usage = calculateBudgetUsage(budget.limitPaise, totalSpentPaise);

    const limitRupees = (Number(budget.limitPaise) / 100).toFixed(0);
    const spentRupees = (Number(totalSpentPaise) / 100).toFixed(0);

    // 100% Threshold
    if (usage.usagePercentage >= 100 && !budget.alert100Sent) {
      await prisma.notificationEvent.create({
        data: {
          userId,
          title: 'Budget Limit Exceeded! 🚨',
          message: `You have spent ₹${spentRupees} of your ₹${limitRupees} ${budget.name} (${usage.usagePercentage}%).`,
          type: 'THRESHOLD_100',
          metadata: {
            budgetId: budget.id,
            limitPaise: budget.limitPaise.toString(),
            spentPaise: totalSpentPaise.toString(),
            usagePercentage: usage.usagePercentage,
          },
        },
      });

      await prisma.budget.update({
        where: { id: budget.id },
        data: { alert100Sent: true, alert90Sent: true, alert70Sent: true },
      });

      generatedAlerts.push({ title: 'Budget Limit Exceeded! 🚨', type: 'THRESHOLD_100' });
    }
    // 90% Threshold
    else if (usage.usagePercentage >= 90 && !budget.alert90Sent) {
      await prisma.notificationEvent.create({
        data: {
          userId,
          title: 'Budget Warning: 90% Spent ⚠️',
          message: `You have reached 90% of your ₹${limitRupees} ${budget.name}. Only ₹${(Number(usage.remainingPaise) / 100).toFixed(0)} remaining.`,
          type: 'THRESHOLD_90',
          metadata: {
            budgetId: budget.id,
            limitPaise: budget.limitPaise.toString(),
            spentPaise: totalSpentPaise.toString(),
            usagePercentage: usage.usagePercentage,
          },
        },
      });

      await prisma.budget.update({
        where: { id: budget.id },
        data: { alert90Sent: true, alert70Sent: true },
      });

      generatedAlerts.push({ title: 'Budget Warning: 90% Spent ⚠️', type: 'THRESHOLD_90' });
    }
    // 70% Threshold
    else if (usage.usagePercentage >= 70 && !budget.alert70Sent) {
      await prisma.notificationEvent.create({
        data: {
          userId,
          title: 'Budget Alert: 70% Spent 🔔',
          message: `You have spent 70% of your ₹${limitRupees} ${budget.name}.`,
          type: 'THRESHOLD_70',
          metadata: {
            budgetId: budget.id,
            limitPaise: budget.limitPaise.toString(),
            spentPaise: totalSpentPaise.toString(),
            usagePercentage: usage.usagePercentage,
          },
        },
      });

      await prisma.budget.update({
        where: { id: budget.id },
        data: { alert70Sent: true },
      });

      generatedAlerts.push({ title: 'Budget Alert: 70% Spent 🔔', type: 'THRESHOLD_70' });
    }
  }

  return generatedAlerts;
};
