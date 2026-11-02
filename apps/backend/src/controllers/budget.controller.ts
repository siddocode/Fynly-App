import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  getPeriodBoundaries,
  getBudgetBoundaries,
  detectMonthFromName,
  calculateSafeToSpend,
  calculateBudgetUsage,
  BudgetPeriod,
  PeriodBoundaries,
} from '../utils/budget.utils.js';

export const createBudgetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Budget name is required'),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('MONTHLY'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2020).max(2050).optional(),
  limitPaise: z
    .union([z.number(), z.string()])
    .refine((v) => BigInt(v) > 0n, 'Budget limit must be greater than zero')
    .transform((val) => BigInt(val)),
  dailyLimitPaise: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => (val !== undefined && val !== null && String(val).trim() !== '' ? BigInt(val) : null)),
  weeklyLimitPaise: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => (val !== undefined && val !== null && String(val).trim() !== '' ? BigInt(val) : null)),
  categories: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        limitPaise: z
          .union([z.number(), z.string()])
          .refine((v) => BigInt(v) > 0n, 'Category limit must be greater than zero')
          .transform((val) => BigInt(val)),
      })
    )
    .optional(),
  setActive: z.boolean().optional(),
});

export const createOrUpdateBudget = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const body = createBudgetSchema.parse(req.body);

    let boundaries: PeriodBoundaries;

    let targetMonth = body.month;
    let targetYear = body.year;

    // Only detect month from name as a fallback if the user did not explicitly supply month/year
    if (!targetMonth || !targetYear) {
      const detected = body.name ? detectMonthFromName(body.name) : null;
      if (detected) {
        targetMonth = detected.month;
        targetYear = detected.year;
      }
    }

    if (body.startDate && body.endDate) {
      boundaries = getBudgetBoundaries({
        startDate: body.startDate,
        endDate: body.endDate,
        period: body.period,
      });
    } else if (targetMonth && targetYear) {
      const start = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      const end = new Date(targetYear, targetMonth - 1, lastDay, 23, 59, 59, 999);
      boundaries = getBudgetBoundaries({
        startDate: start,
        endDate: end,
        period: body.period,
      });
    } else {
      boundaries = getPeriodBoundaries(body.period as BudgetPeriod, new Date());
    }

    // Create or update in a transaction
    const budget = await prisma.$transaction(
      async (tx) => {
        let existing = null;
        if (body.id) {
          existing = await tx.budget.findFirst({
            where: { id: body.id, userId },
          });
        }

        // Check if user has any active budget right now
        const currentActiveBudget = await tx.budget.findFirst({
          where: { userId, isActive: true },
        });

        // Determine active status:
        // - If body.setActive is explicitly true, activate this and deactivate others
        // - If creating first budget and no active budget exists, default to true
        // - Otherwise, respect body.setActive (defaults to false)
        const willBeActive =
          body.setActive === true || (!existing && !currentActiveBudget && body.setActive !== false);

        if (willBeActive) {
          await tx.budget.updateMany({
            where: { userId },
            data: { isActive: false },
          });
        }

        let savedBudget;
        if (existing) {
          savedBudget = await tx.budget.update({
            where: { id: existing.id },
            data: {
              name: body.name.trim(),
              limitPaise: body.limitPaise,
              dailyLimitPaise: body.dailyLimitPaise,
              weeklyLimitPaise: body.weeklyLimitPaise,
              startDate: boundaries.startDate,
              endDate: boundaries.endDate,
              isActive: body.setActive !== undefined ? body.setActive : existing.isActive,
            },
          });

          // Clear previous category budgets to re-sync
          await tx.budgetCategory.deleteMany({
            where: { budgetId: existing.id },
          });
        } else {
          savedBudget = await tx.budget.create({
            data: {
              userId,
              name: body.name.trim(),
              period: body.period as BudgetPeriod,
              limitPaise: body.limitPaise,
              dailyLimitPaise: body.dailyLimitPaise,
              weeklyLimitPaise: body.weeklyLimitPaise,
              startDate: boundaries.startDate,
              endDate: boundaries.endDate,
              isActive: willBeActive,
            },
          });
        }

        // Add category limits if provided and valid
        if (body.categories && body.categories.length > 0) {
          const requestedCategoryIds = body.categories.map((c) => c.categoryId);
          const validCategories = await tx.category.findMany({
            where: {
              id: { in: requestedCategoryIds },
              OR: [{ userId: null }, { userId }],
            },
            select: { id: true },
          });
          const validCategoryIdsSet = new Set(validCategories.map((c) => c.id));
          const validCategoryPayload = body.categories.filter((c) =>
            validCategoryIdsSet.has(c.categoryId)
          );

          if (validCategoryPayload.length > 0) {
            await tx.budgetCategory.createMany({
              data: validCategoryPayload.map((c) => ({
                budgetId: savedBudget.id,
                categoryId: c.categoryId,
                limitPaise: c.limitPaise,
              })),
            });
          }
        }

        return tx.budget.findUnique({
          where: { id: savedBudget.id },
          include: {
            categories: {
              include: { category: true },
            },
          },
        });
      },
      { maxWait: 10000, timeout: 20000 }
    );

    res.status(201).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    next(error);
  }
};

export const getBudgets = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const budgets = await prisma.budget.findMany({
      where: { userId },
      include: {
        categories: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, color: true, icon: true },
            },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    const now = new Date();

    // Calculate dynamic usage for each budget
    const enrichedBudgets = await Promise.all(
      budgets.map(async (budget) => {
        const boundaries = getBudgetBoundaries(budget, now);

        // Fetch settled expenses and income within this budget's period
        const [expenses, incomes] = await Promise.all([
          prisma.transaction.findMany({
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
          }),
          prisma.transaction.findMany({
            where: {
              userId,
              type: 'INCOME',
              status: 'SETTLED',
              date: {
                gte: boundaries.startDate,
                lte: boundaries.endDate,
              },
            },
            select: {
              amountPaise: true,
            },
          }),
        ]);

        // Total spent and income in this budget period
        const totalSpentPaise = expenses.reduce(
          (sum, tx) => sum + BigInt(tx.amountPaise),
          0n
        );

        const totalIncomePaise = incomes.reduce(
          (sum, tx) => sum + BigInt(tx.amountPaise),
          0n
        );

        const baseLimitPaise = budget.limitPaise;
        const effectiveLimitPaise = baseLimitPaise + totalIncomePaise;

        const overallUsage = calculateBudgetUsage(effectiveLimitPaise, totalSpentPaise);
        const safeToSpendTodayPaise = calculateSafeToSpend(
          overallUsage.remainingPaise,
          boundaries.remainingDays
        );

        // Category-wise spending map
        const spentByCategory: Record<string, bigint> = {};
        for (const tx of expenses) {
          if (tx.categoryId) {
            spentByCategory[tx.categoryId] =
              (spentByCategory[tx.categoryId] || 0n) + BigInt(tx.amountPaise);
          }
        }

        const enrichedCategories = budget.categories.map((bc) => {
          const categorySpentPaise = spentByCategory[bc.categoryId] || 0n;
          const usage = calculateBudgetUsage(bc.limitPaise, categorySpentPaise);
          return {
            id: bc.id,
            categoryId: bc.categoryId,
            category: bc.category,
            limitPaise: bc.limitPaise.toString(),
            spentPaise: categorySpentPaise.toString(),
            remainingPaise: usage.remainingPaise.toString(),
            usagePercentage: usage.usagePercentage,
            status: usage.status,
          };
        });

        return {
          id: budget.id,
          name: budget.name,
          period: budget.period,
          baseLimitPaise: baseLimitPaise.toString(),
          incomePaise: totalIncomePaise.toString(),
          limitPaise: effectiveLimitPaise.toString(),
          dailyLimitPaise: budget.dailyLimitPaise ? budget.dailyLimitPaise.toString() : null,
          weeklyLimitPaise: budget.weeklyLimitPaise ? budget.weeklyLimitPaise.toString() : null,
          spentPaise: totalSpentPaise.toString(),
          remainingPaise: overallUsage.remainingPaise.toString(),
          usagePercentage: overallUsage.usagePercentage,
          status: overallUsage.status,
          isActive: budget.isActive,
          safeToSpendTodayPaise: safeToSpendTodayPaise.toString(),
          periodDetails: {
            startDate: boundaries.startDate,
            endDate: boundaries.endDate,
            totalDays: boundaries.totalDays,
            remainingDays: boundaries.remainingDays,
            daysElapsed: boundaries.daysElapsed,
          },
          categories: enrichedCategories,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedBudgets,
    });
  } catch (error) {
    next(error);
  }
};

export const activateBudget = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new AppError('Budget not found', 404);
    }

    await prisma.$transaction([
      prisma.budget.updateMany({
        where: { userId },
        data: { isActive: false },
      }),
      prisma.budget.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: { message: 'Budget plan activated successfully', activeBudgetId: id },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBudget = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const clearTransactions = req.query.clearTransactions === 'true';

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new AppError('Budget not found', 404);
    }

    const wasActive = budget.isActive;

    await prisma.$transaction(
      async (tx) => {
        if (clearTransactions) {
          const boundaries = getBudgetBoundaries(budget);
          const periodTransactions = await tx.transaction.findMany({
            where: {
              userId,
              date: {
                gte: boundaries.startDate,
                lte: boundaries.endDate,
              },
            },
          });

          for (const t of periodTransactions) {
            if (t.type === 'EXPENSE') {
              await tx.financialAccount.update({
                where: { id: t.accountId },
                data: { balancePaise: { increment: t.amountPaise } },
              });
            } else if (t.type === 'INCOME' || t.type === 'REFUND') {
              await tx.financialAccount.update({
                where: { id: t.accountId },
                data: { balancePaise: { decrement: t.amountPaise } },
              });
            }
          }

          if (periodTransactions.length > 0) {
            await tx.transaction.deleteMany({
              where: {
                id: { in: periodTransactions.map((t) => t.id) },
              },
            });
          }
        }

        await tx.budget.delete({
          where: { id },
        });

        // If the deleted budget was active, automatically activate the most recent remaining budget if any exists
        if (wasActive) {
          const remainingBudget = await tx.budget.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });
          if (remainingBudget) {
            await tx.budget.update({
              where: { id: remainingBudget.id },
              data: { isActive: true },
            });
          }
        }
      },
      { maxWait: 10000, timeout: 25000 }
    );

    res.status(200).json({
      success: true,
      data: {
        message: clearTransactions
          ? 'Budget plan and associated month transactions deleted successfully'
          : 'Budget deleted successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};
