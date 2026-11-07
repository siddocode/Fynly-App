import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { generateTransactionFingerprint } from '../utils/fingerprint.js';
import { evaluateBudgetThresholds } from '../utils/alert.utils.js';
import { buildTrackerSummary } from '../utils/tracker.utils.js';

export const createTrackerSchema = z.object({
  name: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
  startedAt: z.string().optional(),
});

export const updateTrackerSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const listTrackersSchema = z.object({
  status: z.enum(['active', 'ended', 'all']).optional().default('all'),
});

export const addTrackerExpenseSchema = z.object({
  accountId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  amountPaise: z
    .union([z.number(), z.string()])
    .refine((v) => BigInt(v) > 0n, 'Amount must be greater than zero')
    .transform((val) => BigInt(val)),
  date: z.string().default(() => new Date().toISOString()),
  description: z.string().optional().default(''),
  merchantName: z.string().optional(),
  notes: z.string().optional(),
  referenceNumber: z.string().optional(),
  allowDuplicate: z.boolean().default(true),
});

const trackerWithTransactions = {
  transactions: {
    orderBy: { date: 'desc' as const },
    select: { amountPaise: true, date: true },
  },
};

const getOwnedTracker = async (userId: string, id: string) => {
  const tracker = await prisma.spendingTracker.findFirst({
    where: { id, userId },
  });

  if (!tracker) {
    throw new AppError('Spending tracker not found', 404);
  }

  return tracker;
};

const defaultTrackerName = (date: Date): string => {
  const label = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
  return `Spending · ${label}`;
};

export const createTracker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const body = createTrackerSchema.parse(req.body);

    const activeTracker = await prisma.spendingTracker.findFirst({
      where: { userId, isActive: true },
    });

    if (activeTracker) {
      throw new AppError(
        'You already have an active spending tracker. End it before starting a new one.',
        409,
        { activeTrackerId: activeTracker.id }
      );
    }

    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();

    const tracker = await prisma.spendingTracker.create({
      data: {
        userId,
        name: body.name || defaultTrackerName(startedAt),
        note: body.note?.trim() || null,
        startedAt,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...tracker,
        summary: buildTrackerSummary(tracker, []),
        transactions: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTrackers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const query = listTrackersSchema.parse(req.query);

    const trackers = await prisma.spendingTracker.findMany({
      where: {
        userId,
        ...(query.status === 'active'
          ? { isActive: true }
          : query.status === 'ended'
          ? { isActive: false }
          : {}),
      },
      orderBy: [{ isActive: 'desc' }, { startedAt: 'desc' }],
      include: trackerWithTransactions,
    });

    const data = trackers.map(({ transactions, ...tracker }) => ({
      ...tracker,
      summary: buildTrackerSummary(tracker, transactions),
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getTrackerById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const tracker = await prisma.spendingTracker.findFirst({
      where: { id, userId },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          include: {
            account: {
              select: { id: true, name: true, type: true, color: true },
            },
            category: {
              select: { id: true, name: true, color: true, icon: true },
            },
          },
        },
      },
    });

    if (!tracker) {
      throw new AppError('Spending tracker not found', 404);
    }

    const { transactions, ...trackerData } = tracker;

    res.status(200).json({
      success: true,
      data: {
        ...trackerData,
        summary: buildTrackerSummary(trackerData, transactions),
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTracker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const body = updateTrackerSchema.parse(req.body);

    await getOwnedTracker(userId, id);

    const tracker = await prisma.spendingTracker.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.note !== undefined ? { note: body.note || null } : {}),
      },
      include: trackerWithTransactions,
    });

    const { transactions, ...trackerData } = tracker;

    res.status(200).json({
      success: true,
      data: {
        ...trackerData,
        summary: buildTrackerSummary(trackerData, transactions),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addTrackerExpense = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const body = addTrackerExpenseSchema.parse(req.body);

    const tracker = await getOwnedTracker(userId, id);

    if (!tracker.isActive) {
      throw new AppError('This spending tracker has ended. Start a new tracker to add expenses.', 400);
    }

    let account = null;
    if (body.accountId) {
      account = await prisma.financialAccount.findFirst({
        where: { id: body.accountId, userId, isArchived: false },
      });
      if (!account) {
        throw new AppError('Account not found', 404);
      }
    } else {
      account = await prisma.financialAccount.findFirst({
        where: { userId, isArchived: false },
        orderBy: { createdAt: 'asc' },
      });
      if (!account) {
        throw new AppError('No account available to record this expense', 400);
      }
    }

    let finalCategoryId = body.categoryId || null;
    if (!finalCategoryId) {
      const defaultCategory = await prisma.category.findFirst({
        where: {
          OR: [
            { userId, slug: 'other' },
            { userId, name: { equals: 'Other', mode: 'insensitive' } },
            { isDefault: true, slug: 'other' },
            { userId },
          ],
        },
      });
      if (defaultCategory) {
        finalCategoryId = defaultCategory.id;
      }
    }

    const effectiveDescription =
      body.description.trim() ||
      (finalCategoryId
        ? (await prisma.category.findUnique({ where: { id: finalCategoryId } }))?.name || 'Expense'
        : 'Expense');

    const fingerprintHash = generateTransactionFingerprint({
      userId,
      accountId: account.id,
      date: body.date,
      amountPaise: body.amountPaise,
      description: effectiveDescription,
      merchantName: body.merchantName,
    });

    if (!body.allowDuplicate) {
      const existing = await prisma.transaction.findFirst({
        where: { userId, fingerprintHash },
      });
      if (existing) {
        throw new AppError(
          'A transaction with identical account, date, amount, and merchant already exists',
          409,
          { duplicateTransactionId: existing.id }
        );
      }
    }

    const transaction = await prisma.$transaction(
      async (tx) => {
        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: account!.id,
            categoryId: finalCategoryId,
            trackerId: tracker.id,
            type: 'EXPENSE',
            amountPaise: body.amountPaise,
            date: new Date(body.date),
            description: effectiveDescription,
            merchantName: body.merchantName?.trim() || null,
            notes: body.notes?.trim() || null,
            fingerprintHash,
            referenceNumber: body.referenceNumber || null,
          },
          include: {
            account: {
              select: { id: true, name: true, type: true, color: true },
            },
            category: {
              select: { id: true, name: true, color: true, icon: true },
            },
          },
        });

        await tx.financialAccount.update({
          where: { id: account!.id },
          data: { balancePaise: { decrement: body.amountPaise } },
        });

        return created;
      },
      { maxWait: 10000, timeout: 20000 }
    );

    evaluateBudgetThresholds(prisma, userId).catch((err) =>
      console.error('Threshold alert evaluation failed:', err)
    );

    const summaryTransactions = await prisma.transaction.findMany({
      where: { trackerId: tracker.id },
      select: { amountPaise: true, date: true },
    });

    res.status(201).json({
      success: true,
      data: {
        transaction,
        summary: buildTrackerSummary(tracker, summaryTransactions),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const endTracker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const tracker = await getOwnedTracker(userId, id);

    const endedAt = tracker.endedAt || new Date();

    const updated = tracker.isActive
      ? await prisma.spendingTracker.update({
          where: { id },
          data: { isActive: false, endedAt },
        })
      : tracker;

    const transactions = await prisma.transaction.findMany({
      where: { trackerId: tracker.id },
      orderBy: { date: 'desc' },
      select: { amountPaise: true, date: true },
    });

    res.status(200).json({
      success: true,
      data: {
        ...updated,
        summary: buildTrackerSummary(updated, transactions),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTracker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const tracker = await getOwnedTracker(userId, id);

    if (tracker.isActive) {
      throw new AppError('End this spending tracker before deleting it', 400);
    }

    // Linked transactions are preserved; the relation is cleared via SetNull.
    await prisma.spendingTracker.delete({ where: { id } });

    res.status(200).json({
      success: true,
      data: { message: 'Spending tracker deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTrackerExpense = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const transactionId = req.params.transactionId as string;

    const tracker = await getOwnedTracker(userId, id);

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId, trackerId: tracker.id },
    });

    if (!transaction) {
      throw new AppError('Tracker expense not found', 404);
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.financialAccount.update({
          where: { id: transaction.accountId },
          data: { balancePaise: { increment: transaction.amountPaise } },
        });
        await tx.transaction.delete({ where: { id: transaction.id } });
      },
      { maxWait: 10000, timeout: 20000 }
    );

    const transactions = await prisma.transaction.findMany({
      where: { trackerId: tracker.id },
      select: { amountPaise: true, date: true },
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Tracker expense deleted successfully',
        summary: buildTrackerSummary(tracker, transactions),
      },
    });
  } catch (error) {
    next(error);
  }
};
