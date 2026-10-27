import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  getPeriodBoundaries,
  calculateSafeToSpend,
  calculateBudgetUsage,
} from '../utils/budget.utils.js';

export const getDashboardSummary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const now = new Date();

    const todayBoundaries = getPeriodBoundaries('DAILY', now);
    const monthBoundaries = getPeriodBoundaries('MONTHLY', now);

    // Run parallel queries for dashboard aggregation
    const [accounts, todayExpenses, monthExpenses, monthlyBudget, recentTransactions] =
      await Promise.all([
        // 1. All active accounts
        prisma.financialAccount.findMany({
          where: { userId, isArchived: false },
          select: { id: true, name: true, type: true, balancePaise: true, color: true },
        }),

        // 2. Today's settled expenses
        prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            status: 'SETTLED',
            date: {
              gte: todayBoundaries.startDate,
              lte: todayBoundaries.endDate,
            },
          },
          select: { amountPaise: true },
        }),

        // 3. Month's settled expenses with categories
        prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            status: 'SETTLED',
            date: {
              gte: monthBoundaries.startDate,
              lte: monthBoundaries.endDate,
            },
          },
          select: {
            amountPaise: true,
            categoryId: true,
            category: {
              select: { id: true, name: true, color: true, icon: true },
            },
          },
        }),

        // 4. User's active Monthly Budget
        prisma.budget.findFirst({
          where: { userId, period: 'MONTHLY' },
          include: {
            categories: {
              include: { category: true },
            },
          },
        }),

        // 5. Recent 5 transactions
        prisma.transaction.findMany({
          where: { userId },
          take: 5,
          orderBy: { date: 'desc' },
          include: {
            account: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
        }),
      ]);

    // Calculate total net balance
    const totalBalancePaise = accounts.reduce((sum, acc) => {
      if (acc.type === 'CREDIT_CARD') {
        return sum - BigInt(acc.balancePaise);
      }
      return sum + BigInt(acc.balancePaise);
    }, 0n);

    // Calculate today's total spending
    const todaySpentPaise = todayExpenses.reduce(
      (sum, tx) => sum + BigInt(tx.amountPaise),
      0n
    );

    // Calculate month's total spending
    const monthSpentPaise = monthExpenses.reduce(
      (sum, tx) => sum + BigInt(tx.amountPaise),
      0n
    );

    // Budget & Safe-to-Spend calculations
    let budgetSummary = null;
    let safeToSpendTodayPaise = 0n;

    if (monthlyBudget) {
      const usage = calculateBudgetUsage(monthlyBudget.limitPaise, monthSpentPaise);
      safeToSpendTodayPaise = calculateSafeToSpend(
        usage.remainingPaise,
        monthBoundaries.remainingDays
      );

      budgetSummary = {
        id: monthlyBudget.id,
        name: monthlyBudget.name,
        limitPaise: monthlyBudget.limitPaise.toString(),
        spentPaise: monthSpentPaise.toString(),
        remainingPaise: usage.remainingPaise.toString(),
        usagePercentage: usage.usagePercentage,
        status: usage.status,
        remainingDays: monthBoundaries.remainingDays,
        daysElapsed: monthBoundaries.daysElapsed,
        totalDays: monthBoundaries.totalDays,
      };
    } else {
      // If no explicit budget set, calculate safe-to-spend from positive net balance
      if (totalBalancePaise > 0n) {
        safeToSpendTodayPaise = calculateSafeToSpend(
          totalBalancePaise,
          monthBoundaries.remainingDays
        );
      }
    }

    // Top Category Breakdown for this month
    const categoryTotals: Record<
      string,
      { category: { id: string; name: string; color: string | null; icon: string | null }; spentPaise: bigint }
    > = {};

    for (const tx of monthExpenses) {
      if (tx.category) {
        const catId = tx.category.id;
        if (!categoryTotals[catId]) {
          categoryTotals[catId] = {
            category: tx.category,
            spentPaise: 0n,
          };
        }
        categoryTotals[catId].spentPaise += BigInt(tx.amountPaise);
      }
    }

    const topCategories = Object.values(categoryTotals)
      .map((item) => ({
        ...item.category,
        spentPaise: item.spentPaise.toString(),
        percentage:
          monthSpentPaise > 0n
            ? Number((item.spentPaise * 10000n) / monthSpentPaise) / 100
            : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 4);

    res.status(200).json({
      success: true,
      data: {
        totalBalancePaise: totalBalancePaise.toString(),
        todaySpentPaise: todaySpentPaise.toString(),
        monthSpentPaise: monthSpentPaise.toString(),
        safeToSpendTodayPaise: safeToSpendTodayPaise.toString(),
        budget: budgetSummary,
        topCategories,
        accountsCount: accounts.length,
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};
