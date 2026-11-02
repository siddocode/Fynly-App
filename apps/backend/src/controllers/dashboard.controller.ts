import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  getPeriodBoundaries,
  getBudgetBoundaries,
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
    const weekBoundaries = getPeriodBoundaries('WEEKLY', now);
    const monthBoundaries = getPeriodBoundaries('MONTHLY', now);

    // Run parallel queries for dashboard aggregation
    const [
      accounts,
      monthlyBudget,
      dailyBudget,
      weeklyBudget,
      recentTransactions,
    ] = await Promise.all([
      // 1. All active accounts
      prisma.financialAccount.findMany({
        where: { userId, isArchived: false },
        select: { id: true, name: true, type: true, balancePaise: true, color: true },
      }),

      // 2. User's active Budget
      prisma.budget.findFirst({
        where: { userId, isActive: true },
        include: {
          categories: {
            include: { category: true },
          },
        },
      }),

      // 3. User's active Daily Budget (if set as dedicated budget)
      prisma.budget.findFirst({
        where: { userId, period: 'DAILY', isActive: true },
      }),

      // 4. User's active Weekly Budget (if set as dedicated budget)
      prisma.budget.findFirst({
        where: { userId, period: 'WEEKLY', isActive: true },
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

    let budgetSummary = null;
    let safeToSpendTodayPaise = 0n;
    let todaySpentPaise = 0n;
    let weekSpentPaise = 0n;
    let monthSpentPaise = 0n;
    let topCategories: Array<{
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
      spentPaise: string;
      percentage: number;
    }> = [];

    if (monthlyBudget) {
      const activeBoundaries = getBudgetBoundaries(monthlyBudget, now);

      // Check whether today and current week fall within the active budget cycle
      const isTodayInBudgetCycle =
        now.getTime() >= activeBoundaries.startDate.getTime() &&
        now.getTime() <= activeBoundaries.endDate.getTime();

      const isWeekInBudgetCycle =
        weekBoundaries.endDate.getTime() >= activeBoundaries.startDate.getTime() &&
        weekBoundaries.startDate.getTime() <= activeBoundaries.endDate.getTime();

      const [
        activeBudgetExpenses,
        activeBudgetIncome,
        todayBudgetExpenses,
        weekBudgetExpenses,
      ] = await Promise.all([
        // Expenses strictly within this active budget cycle
        prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            status: 'SETTLED',
            date: {
              gte: activeBoundaries.startDate,
              lte: activeBoundaries.endDate,
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

        // Income earned within this active budget cycle (pools into total budget value & daily allowance)
        prisma.transaction.findMany({
          where: {
            userId,
            type: 'INCOME',
            status: 'SETTLED',
            date: {
              gte: activeBoundaries.startDate,
              lte: activeBoundaries.endDate,
            },
          },
          select: { amountPaise: true },
        }),

        // Today's expenses towards this active budget (strictly 0 if today is outside this budget's cycle)
        isTodayInBudgetCycle
          ? prisma.transaction.findMany({
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
            })
          : Promise.resolve([]),

        // This week's expenses towards this active budget
        isWeekInBudgetCycle
          ? prisma.transaction.findMany({
              where: {
                userId,
                type: 'EXPENSE',
                status: 'SETTLED',
                date: {
                  gte: new Date(Math.max(weekBoundaries.startDate.getTime(), activeBoundaries.startDate.getTime())),
                  lte: new Date(Math.min(weekBoundaries.endDate.getTime(), activeBoundaries.endDate.getTime())),
                },
              },
              select: { amountPaise: true },
            })
          : Promise.resolve([]),
      ]);

      const activeBudgetSpentPaise = activeBudgetExpenses.reduce(
        (sum, tx) => sum + BigInt(tx.amountPaise),
        0n
      );

      const totalIncomePaise = activeBudgetIncome.reduce(
        (sum, tx) => sum + BigInt(tx.amountPaise),
        0n
      );

      // Income increases the total monthly budget value and available spending pool
      const baseLimitPaise = monthlyBudget.limitPaise;
      const effectiveLimitPaise = baseLimitPaise + totalIncomePaise;

      const usage = calculateBudgetUsage(effectiveLimitPaise, activeBudgetSpentPaise);
      safeToSpendTodayPaise = calculateSafeToSpend(
        usage.remainingPaise,
        activeBoundaries.remainingDays
      );

      todaySpentPaise = todayBudgetExpenses.reduce(
        (sum, tx) => sum + BigInt(tx.amountPaise),
        0n
      );

      weekSpentPaise = weekBudgetExpenses.reduce(
        (sum, tx) => sum + BigInt(tx.amountPaise),
        0n
      );

      monthSpentPaise = activeBudgetSpentPaise;

      budgetSummary = {
        id: monthlyBudget.id,
        name: monthlyBudget.name,
        baseLimitPaise: baseLimitPaise.toString(),
        incomePaise: totalIncomePaise.toString(),
        limitPaise: effectiveLimitPaise.toString(),
        dailyLimitPaise: monthlyBudget.dailyLimitPaise ? monthlyBudget.dailyLimitPaise.toString() : null,
        weeklyLimitPaise: monthlyBudget.weeklyLimitPaise ? monthlyBudget.weeklyLimitPaise.toString() : null,
        spentPaise: activeBudgetSpentPaise.toString(),
        remainingPaise: usage.remainingPaise.toString(),
        usagePercentage: usage.usagePercentage,
        status: usage.status,
        remainingDays: activeBoundaries.remainingDays,
        daysElapsed: activeBoundaries.daysElapsed,
        totalDays: activeBoundaries.totalDays,
      };

      // Top Category Breakdown for this active budget
      const categoryTotals: Record<
        string,
        { category: { id: string; name: string; color: string | null; icon: string | null }; spentPaise: bigint }
      > = {};

      for (const tx of activeBudgetExpenses) {
        const catId = tx.category?.id || 'other';
        const catName = tx.category?.name || 'Other';
        const catColor = tx.category?.color || '#64748B';
        const catIcon = tx.category?.icon || 'MoreHorizontal';

        if (!categoryTotals[catId]) {
          categoryTotals[catId] = {
            category: { id: catId, name: catName, color: catColor, icon: catIcon },
            spentPaise: 0n,
          };
        }
        categoryTotals[catId].spentPaise += BigInt(tx.amountPaise);
      }

      topCategories = Object.values(categoryTotals)
        .map((item) => ({
          ...item.category,
          spentPaise: item.spentPaise.toString(),
          percentage:
            activeBudgetSpentPaise > 0n
              ? Number((item.spentPaise * 10000n) / activeBudgetSpentPaise) / 100
              : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 4);
    } else {
      // Fallback when no active budget plan is configured
      const [allTodayExpenses, allMonthExpenses] = await Promise.all([
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
      ]);

      todaySpentPaise = allTodayExpenses.reduce(
        (sum, tx) => sum + BigInt(tx.amountPaise),
        0n
      );

      monthSpentPaise = allMonthExpenses.reduce(
        (sum, tx) => sum + BigInt(tx.amountPaise),
        0n
      );

      const categoryTotals: Record<
        string,
        { category: { id: string; name: string; color: string | null; icon: string | null }; spentPaise: bigint }
      > = {};

      for (const tx of allMonthExpenses) {
        const catId = tx.category?.id || 'other';
        const catName = tx.category?.name || 'Other';
        const catColor = tx.category?.color || '#64748B';
        const catIcon = tx.category?.icon || 'MoreHorizontal';

        if (!categoryTotals[catId]) {
          categoryTotals[catId] = {
            category: { id: catId, name: catName, color: catColor, icon: catIcon },
            spentPaise: 0n,
          };
        }
        categoryTotals[catId].spentPaise += BigInt(tx.amountPaise);
      }

      topCategories = Object.values(categoryTotals)
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
    }

    // Determine Daily Limit
    let dailyLimitPaise = 0n;
    let isDailyAutoGenerated = false;

    if (dailyBudget) {
      dailyLimitPaise = dailyBudget.limitPaise;
    } else if (monthlyBudget?.dailyLimitPaise) {
      dailyLimitPaise = monthlyBudget.dailyLimitPaise;
      // Add boost from income if any
      const remDays = budgetSummary?.remainingDays && budgetSummary.remainingDays > 0 ? budgetSummary.remainingDays : 0;
      if (budgetSummary?.incomePaise && BigInt(budgetSummary.incomePaise) > 0n && remDays > 0) {
        dailyLimitPaise += BigInt(budgetSummary.incomePaise) / BigInt(remDays);
      }
    } else if (safeToSpendTodayPaise > 0n) {
      dailyLimitPaise = safeToSpendTodayPaise;
      isDailyAutoGenerated = true;
    }

    const hasActiveDailyLimit = dailyLimitPaise > 0n || !!dailyBudget;
    const isDailyExceeded = dailyLimitPaise > 0n && todaySpentPaise > dailyLimitPaise;
    const dailyExceededByPaise = isDailyExceeded ? todaySpentPaise - dailyLimitPaise : 0n;
    const dailyRemainingPaise = dailyLimitPaise > todaySpentPaise ? dailyLimitPaise - todaySpentPaise : 0n;
    const dailyUsagePercentage =
      dailyLimitPaise > 0n
        ? Math.round(Number((todaySpentPaise * 100n) / dailyLimitPaise))
        : 0;

    const dailyOverview = hasActiveDailyLimit
      ? {
        limitPaise: dailyLimitPaise.toString(),
        spentPaise: todaySpentPaise.toString(),
        remainingPaise: dailyRemainingPaise.toString(),
        usagePercentage: dailyUsagePercentage,
        isExceeded: isDailyExceeded,
        exceededByPaise: dailyExceededByPaise.toString(),
        isAutoGenerated: isDailyAutoGenerated,
      }
      : null;

    // Determine Weekly Limit
    let weeklyLimitPaise = 0n;
    let isWeeklyAutoGenerated = false;

    if (weeklyBudget) {
      weeklyLimitPaise = weeklyBudget.limitPaise;
    } else if (monthlyBudget?.weeklyLimitPaise) {
      weeklyLimitPaise = monthlyBudget.weeklyLimitPaise;
    } else if (budgetSummary) {
      // Approx 1/4th of effective monthly budget
      weeklyLimitPaise = BigInt(budgetSummary.limitPaise) / 4n;
      isWeeklyAutoGenerated = true;
    }

    const hasActiveWeeklyLimit = weeklyLimitPaise > 0n || !!weeklyBudget;
    const isWeeklyExceeded = weeklyLimitPaise > 0n && weekSpentPaise > weeklyLimitPaise;
    const weeklyExceededByPaise = isWeeklyExceeded ? weekSpentPaise - weeklyLimitPaise : 0n;
    const weeklyRemainingPaise = weeklyLimitPaise > weekSpentPaise ? weeklyLimitPaise - weekSpentPaise : 0n;
    const weeklyUsagePercentage =
      weeklyLimitPaise > 0n
        ? Math.round(Number((weekSpentPaise * 100n) / weeklyLimitPaise))
        : 0;

    const weeklyOverview = hasActiveWeeklyLimit
      ? {
        limitPaise: weeklyLimitPaise.toString(),
        spentPaise: weekSpentPaise.toString(),
        remainingPaise: weeklyRemainingPaise.toString(),
        usagePercentage: weeklyUsagePercentage,
        isExceeded: isWeeklyExceeded,
        exceededByPaise: weeklyExceededByPaise.toString(),
        isAutoGenerated: isWeeklyAutoGenerated,
      }
      : null;

    res.status(200).json({
      success: true,
      data: {
        totalBalancePaise: totalBalancePaise.toString(),
        todaySpentPaise: todaySpentPaise.toString(),
        weekSpentPaise: weekSpentPaise.toString(),
        monthSpentPaise: monthSpentPaise.toString(),
        safeToSpendTodayPaise: safeToSpendTodayPaise.toString(),
        dailyOverview,
        weeklyOverview,
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
