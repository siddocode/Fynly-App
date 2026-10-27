import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  getPeriodBoundaries,
  calculateSafeToSpend,
  calculateBudgetUsage,
  BudgetPeriod,
} from '../utils/budget.utils.js';

export const createBudgetSchema = z.object({
  name: z.string().min(1, 'Budget name is required'),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('MONTHLY'),
  limitPaise: z
    .union([z.number(), z.string()])
    .refine((v) => BigInt(v) > 0n, 'Budget limit must be greater than zero')
    .transform((val) => BigInt(val)),
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
});

export const createOrUpdateBudget = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const body = createBudgetSchema.parse(req.body);

    const boundaries = getPeriodBoundaries(body.period as BudgetPeriod);

    // Create or update in a transaction
    const budget = await prisma.$transaction(
      async (tx) => {
        // Find existing budget of same period or name
        const existing = await tx.budget.findFirst({
          where: { userId, period: body.period as BudgetPeriod },
        });

        let savedBudget;
        if (existing) {
          savedBudget = await tx.budget.update({
            where: { id: existing.id },
            data: {
              name: body.name.trim(),
              limitPaise: body.limitPaise,
              startDate: boundaries.startDate,
              endDate: boundaries.endDate,
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
              startDate: boundaries.startDate,
              endDate: boundaries.endDate,
            },
          });
        }

        // Add category limits if provided
        if (body.categories && body.categories.length > 0) {
          await tx.budgetCategory.createMany({
            data: body.categories.map((c) => ({
              budgetId: savedBudget.id,
              categoryId: c.categoryId,
              limitPaise: c.limitPaise,
            })),
          });
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
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    // Calculate dynamic usage for each budget
    const enrichedBudgets = await Promise.all(
      budgets.map(async (budget) => {
        const boundaries = getPeriodBoundaries(budget.period as BudgetPeriod, now);

        // Fetch settled expenses within this budget's period
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

        // Total spent in this budget period
        const totalSpentPaise = expenses.reduce(
          (sum, tx) => sum + BigInt(tx.amountPaise),
          0n
        );

        const overallUsage = calculateBudgetUsage(budget.limitPaise, totalSpentPaise);
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
          limitPaise: budget.limitPaise.toString(),
          spentPaise: totalSpentPaise.toString(),
          remainingPaise: overallUsage.remainingPaise.toString(),
          usagePercentage: overallUsage.usagePercentage,
          status: overallUsage.status,
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

export const deleteBudget = async (
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

    await prisma.budget.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      data: { message: 'Budget deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
};
