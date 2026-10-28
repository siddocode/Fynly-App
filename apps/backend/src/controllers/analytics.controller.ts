import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getPeriodBoundaries } from '../utils/budget.utils.js';

interface CategoryAggregate {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  spentPaise: bigint;
  count: number;
}

interface MerchantAggregate {
  name: string;
  spentPaise: bigint;
  count: number;
}

/**
 * GET /api/v1/analytics/overview
 * Consolidates category breakdowns, weekly trends, MoM comparisons, and burn rate forecast.
 */
export const getInsightsOverview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const now = new Date();

    // Parse requested month if specified as 'YYYY-MM', otherwise default to current month
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth(); // 0-indexed

    if (typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)) {
      const [yearStr, monthStr] = req.query.month.split('-');
      targetYear = parseInt(yearStr, 10);
      targetMonth = parseInt(monthStr, 10) - 1;
    }

    const startOfMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    const totalDaysInMonth = endOfMonth.getDate();

    // Previous month boundaries
    const startOfPrevMonth = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const endOfPrevMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Fetch transactions for both months and monthly budget
    const [currentMonthTxns, prevMonthTxns, monthlyBudget] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          status: 'SETTLED',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          status: 'SETTLED',
          date: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
        select: { type: true, amountPaise: true },
      }),
      prisma.budget.findFirst({
        where: { userId, period: 'MONTHLY' },
      }),
    ]);

    // Current month totals
    let currentMonthSpentPaise = 0n;
    let currentMonthIncomePaise = 0n;
    const categoryMap = new Map<string, CategoryAggregate>();
    const merchantMap = new Map<string, MerchantAggregate>();

    for (const tx of currentMonthTxns) {
      const amt = BigInt(tx.amountPaise);
      if (tx.type === 'EXPENSE') {
        currentMonthSpentPaise += amt;

        // Category breakdown
        const catKey = tx.categoryId || 'uncategorized';
        const existingCat = categoryMap.get(catKey);
        if (existingCat) {
          existingCat.spentPaise += amt;
          existingCat.count += 1;
        } else {
          categoryMap.set(catKey, {
            id: tx.category?.id || 'uncategorized',
            name: tx.category?.name || 'Uncategorized',
            slug: tx.category?.slug || 'other',
            color: tx.category?.color || '#94A3B8',
            icon: tx.category?.icon || 'help-circle',
            spentPaise: amt,
            count: 1,
          });
        }

        // Merchant breakdown
        const rawMerchant = (tx.merchantName || tx.description || 'Unknown').trim();
        const normMerchant = rawMerchant.length > 0 ? rawMerchant : 'Unknown';
        const existingMerchant = merchantMap.get(normMerchant);
        if (existingMerchant) {
          existingMerchant.spentPaise += amt;
          existingMerchant.count += 1;
        } else {
          merchantMap.set(normMerchant, {
            name: normMerchant,
            spentPaise: amt,
            count: 1,
          });
        }
      } else if (tx.type === 'INCOME') {
        currentMonthIncomePaise += amt;
      }
    }

    // Previous month totals
    let prevMonthSpentPaise = 0n;
    let prevMonthIncomePaise = 0n;
    for (const tx of prevMonthTxns) {
      const amt = BigInt(tx.amountPaise);
      if (tx.type === 'EXPENSE') prevMonthSpentPaise += amt;
      else if (tx.type === 'INCOME') prevMonthIncomePaise += amt;
    }

    // Month-over-month comparison
    const momDifferencePaise = currentMonthSpentPaise - prevMonthSpentPaise;
    let momPercentageChange = 0;
    if (prevMonthSpentPaise > 0n) {
      momPercentageChange =
        Number(((currentMonthSpentPaise - prevMonthSpentPaise) * 10000n) / prevMonthSpentPaise) / 100;
    }

    // Savings calculations
    const netSavingsPaise = currentMonthIncomePaise - currentMonthSpentPaise;
    let savingsRatePercentage = 0;
    if (currentMonthIncomePaise > 0n && netSavingsPaise > 0n) {
      savingsRatePercentage =
        Number((netSavingsPaise * 10000n) / currentMonthIncomePaise) / 100;
    }

    // Days elapsed & Spending velocity
    const isCurrentCalendarMonth =
      now.getFullYear() === targetYear && now.getMonth() === targetMonth;
    const daysElapsed = isCurrentCalendarMonth ? Math.min(now.getDate(), totalDaysInMonth) : totalDaysInMonth;
    const remainingDays = Math.max(0, totalDaysInMonth - daysElapsed);

    const dailyBurnRatePaise =
      daysElapsed > 0 ? currentMonthSpentPaise / BigInt(daysElapsed) : 0n;
    const projectedMonthEndSpendPaise = dailyBurnRatePaise * BigInt(totalDaysInMonth);

    // Format category breakdown with percentages
    const categories = Array.from(categoryMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        color: c.color,
        icon: c.icon,
        spentPaise: c.spentPaise.toString(),
        count: c.count,
        percentage:
          currentMonthSpentPaise > 0n
            ? Number((c.spentPaise * 10000n) / currentMonthSpentPaise) / 100
            : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Top 5 Merchants
    const topMerchants = Array.from(merchantMap.values())
      .map((m) => ({
        name: m.name,
        spentPaise: m.spentPaise.toString(),
        count: m.count,
        percentage:
          currentMonthSpentPaise > 0n
            ? Number((m.spentPaise * 10000n) / currentMonthSpentPaise) / 100
            : 0,
      }))
      .sort((a, b) => (BigInt(b.spentPaise) > BigInt(a.spentPaise) ? 1 : -1))
      .slice(0, 5);

    // Weekly Breakdown
    const weeklyBreakdown: {
      weekIndex: number;
      label: string;
      startDate: string;
      endDate: string;
      spentPaise: string;
      incomePaise: string;
    }[] = [];

    const weekRanges = [
      { startDay: 1, endDay: 7, label: 'Week 1 (Days 1–7)' },
      { startDay: 8, endDay: 14, label: 'Week 2 (Days 8–14)' },
      { startDay: 15, endDay: 21, label: 'Week 3 (Days 15–21)' },
      { startDay: 22, endDay: 28, label: 'Week 4 (Days 22–28)' },
      { startDay: 29, endDay: totalDaysInMonth, label: `Week 5 (Days 29–${totalDaysInMonth})` },
    ];

    for (let i = 0; i < weekRanges.length; i++) {
      const range = weekRanges[i];
      if (range.startDay > totalDaysInMonth) continue;

      const actualEndDay = Math.min(range.endDay, totalDaysInMonth);
      let weekSpent = 0n;
      let weekIncome = 0n;

      for (const tx of currentMonthTxns) {
        const txDay = tx.date.getDate();
        if (txDay >= range.startDay && txDay <= actualEndDay) {
          if (tx.type === 'EXPENSE') weekSpent += BigInt(tx.amountPaise);
          else if (tx.type === 'INCOME') weekIncome += BigInt(tx.amountPaise);
        }
      }

      weeklyBreakdown.push({
        weekIndex: i + 1,
        label: range.label,
        startDate: new Date(targetYear, targetMonth, range.startDay).toISOString().split('T')[0],
        endDate: new Date(targetYear, targetMonth, actualEndDay).toISOString().split('T')[0],
        spentPaise: weekSpent.toString(),
        incomePaise: weekIncome.toString(),
      });
    }

    res.status(200).json({
      success: true,
      data: {
        period: {
          year: targetYear,
          month: targetMonth + 1,
          monthLabel: startOfMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          daysElapsed,
          totalDays: totalDaysInMonth,
          remainingDays,
        },
        summary: {
          currentMonthSpentPaise: currentMonthSpentPaise.toString(),
          currentMonthIncomePaise: currentMonthIncomePaise.toString(),
          netSavingsPaise: netSavingsPaise.toString(),
          savingsRatePercentage,
          prevMonthSpentPaise: prevMonthSpentPaise.toString(),
          prevMonthIncomePaise: prevMonthIncomePaise.toString(),
          monthOverMonth: {
            differencePaise: momDifferencePaise.toString(),
            percentageChange: momPercentageChange,
            direction:
              momDifferencePaise > 0n
                ? 'INCREASED'
                : momDifferencePaise < 0n
                ? 'DECREASED'
                : 'UNCHANGED',
          },
        },
        forecast: {
          dailyBurnRatePaise: dailyBurnRatePaise.toString(),
          projectedMonthEndSpendPaise: projectedMonthEndSpendPaise.toString(),
          budgetLimitPaise: monthlyBudget ? monthlyBudget.limitPaise.toString() : null,
          projectedVariancePaise: monthlyBudget
            ? (BigInt(monthlyBudget.limitPaise) - projectedMonthEndSpendPaise).toString()
            : null,
          isProjectedWithinBudget: monthlyBudget
            ? projectedMonthEndSpendPaise <= BigInt(monthlyBudget.limitPaise)
            : null,
        },
        categories,
        topMerchants,
        weeklyBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/recurring
 * Intelligent heuristic detector identifying recurring expenses, subscriptions, and periodic bills.
 */
export const getRecurringSubscriptions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const now = new Date();
    // Look back across the last 180 days for cadence analysis
    const lookbackDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const expenseTxns = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        status: 'SETTLED',
        date: { gte: lookbackDate },
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Group expenses by normalized merchant
    const merchantGroups = new Map<string, typeof expenseTxns>();

    for (const tx of expenseTxns) {
      const rawName = (tx.merchantName || tx.description).trim().toLowerCase();
      // Remove generic prefixes/suffixes like 'upi-', 'billpay', numbers
      const cleanName = rawName
        .replace(/^(upi-|bill\s*pay\s*)/i, '')
        .replace(/[-_@].*$/, '')
        .trim();

      const key = cleanName.length >= 3 ? cleanName : rawName;
      if (!merchantGroups.has(key)) {
        merchantGroups.set(key, []);
      }
      merchantGroups.get(key)!.push(tx);
    }

    interface DetectedSubscription {
      id: string;
      merchantName: string;
      cadence: 'MONTHLY' | 'WEEKLY' | 'QUARTERLY';
      amountPaise: string;
      occurrencesCount: number;
      lastPaymentDate: string;
      estimatedNextDueDate: string;
      daysUntilDue: number;
      category: { id: string; name: string; color: string | null; icon: string | null } | null;
    }

    const detectedSubscriptions: DetectedSubscription[] = [];
    let totalMonthlyCommitmentPaise = 0n;

    for (const [, txns] of merchantGroups.entries()) {
      if (txns.length < 2) continue;

      // Check date gaps between consecutive transactions
      const intervalsInDays: number[] = [];
      for (let i = 1; i < txns.length; i++) {
        const gapMs = txns[i].date.getTime() - txns[i - 1].date.getTime();
        intervalsInDays.push(Math.round(gapMs / (1000 * 60 * 60 * 24)));
      }

      const avgInterval =
        intervalsInDays.reduce((a, b) => a + b, 0) / intervalsInDays.length;

      // Determine cadence
      let cadence: 'MONTHLY' | 'WEEKLY' | 'QUARTERLY' | null = null;
      if (avgInterval >= 24 && avgInterval <= 36) {
        cadence = 'MONTHLY';
      } else if (avgInterval >= 5 && avgInterval <= 9) {
        cadence = 'WEEKLY';
      } else if (avgInterval >= 75 && avgInterval <= 105) {
        cadence = 'QUARTERLY';
      }

      // Check amount variance (allow max 20% variance for utility bills)
      const amounts = txns.map((t) => BigInt(t.amountPaise));
      const latestAmount = amounts[amounts.length - 1];
      const hasReasonableAmountMatch = amounts.every((amt) => {
        const diff = amt > latestAmount ? amt - latestAmount : latestAmount - amt;
        return (diff * 100n) / (latestAmount > 0n ? latestAmount : 1n) <= 25n;
      });

      if (cadence && hasReasonableAmountMatch) {
        const lastTx = txns[txns.length - 1];
        const nextDueDate = new Date(lastTx.date);

        if (cadence === 'MONTHLY') {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          totalMonthlyCommitmentPaise += latestAmount;
        } else if (cadence === 'WEEKLY') {
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          totalMonthlyCommitmentPaise += latestAmount * 4n;
        } else if (cadence === 'QUARTERLY') {
          nextDueDate.setMonth(nextDueDate.getMonth() + 3);
          totalMonthlyCommitmentPaise += latestAmount / 3n;
        }

        const daysUntilDue = Math.round(
          (nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        detectedSubscriptions.push({
          id: `sub_${lastTx.id}`,
          merchantName: lastTx.merchantName || lastTx.description,
          cadence,
          amountPaise: latestAmount.toString(),
          occurrencesCount: txns.length,
          lastPaymentDate: lastTx.date.toISOString(),
          estimatedNextDueDate: nextDueDate.toISOString(),
          daysUntilDue,
          category: lastTx.category
            ? {
                id: lastTx.category.id,
                name: lastTx.category.name,
                color: lastTx.category.color,
                icon: lastTx.category.icon,
              }
            : null,
        });
      }
    }

    // Sort by nearest upcoming due date
    detectedSubscriptions.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    res.status(200).json({
      success: true,
      data: {
        totalMonthlyCommitmentPaise: totalMonthlyCommitmentPaise.toString(),
        activeSubscriptionsCount: detectedSubscriptions.length,
        subscriptions: detectedSubscriptions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/trends
 * Multi-month historical spending and income trajectory (last 6 months).
 */
export const getSpendingTrends = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const now = new Date();

    // 6-month historical window
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);

    const txns = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'SETTLED',
        date: { gte: sixMonthsAgo },
      },
      select: {
        type: true,
        amountPaise: true,
        date: true,
      },
      orderBy: { date: 'asc' },
    });

    const monthsMap = new Map<
      string,
      {
        monthKey: string;
        label: string;
        spentPaise: bigint;
        incomePaise: bigint;
      }
    >();

    // Pre-populate all 6 months in chronological order
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthsMap.set(monthKey, {
        monthKey,
        label,
        spentPaise: 0n,
        incomePaise: 0n,
      });
    }

    for (const tx of txns) {
      const monthKey = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthsMap.get(monthKey);
      if (entry) {
        const amt = BigInt(tx.amountPaise);
        if (tx.type === 'EXPENSE') entry.spentPaise += amt;
        else if (tx.type === 'INCOME') entry.incomePaise += amt;
      }
    }

    const history = Array.from(monthsMap.values()).map((m) => ({
      monthKey: m.monthKey,
      label: m.label,
      spentPaise: m.spentPaise.toString(),
      incomePaise: m.incomePaise.toString(),
      netSavingsPaise: (m.incomePaise - m.spentPaise).toString(),
    }));

    res.status(200).json({
      success: true,
      data: {
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};
