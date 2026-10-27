import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { generateTransactionFingerprint } from '../utils/fingerprint.js';
import { evaluateBudgetThresholds } from '../utils/alert.utils.js';

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  toAccountId: z.string().optional(), // For TRANSFER type
  categoryId: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'REFUND']).default('EXPENSE'),
  amountPaise: z
    .union([z.number(), z.string()])
    .refine((v) => BigInt(v) > 0n, 'Amount must be greater than zero')
    .transform((val) => BigInt(val)),
  date: z.string().default(() => new Date().toISOString()),
  description: z.string().min(1, 'Description is required'),
  merchantName: z.string().optional(),
  notes: z.string().optional(),
  referenceNumber: z.string().optional(),
  isRecurring: z.boolean().default(false),
  allowDuplicate: z.boolean().default(false),
});

export const updateTransactionSchema = z.object({
  categoryId: z.string().nullable().optional(),
  description: z.string().min(1).optional(),
  merchantName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  referenceNumber: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
});

export const getTransactionsSchema = z.object({
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v || '1', 10))),
  limit: z.string().optional().transform((v) => Math.min(100, Math.max(1, parseInt(v || '20', 10)))),
  search: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'REFUND']).optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const body = createTransactionSchema.parse(req.body);

    const account = await prisma.financialAccount.findFirst({
      where: { id: body.accountId, userId },
    });

    if (!account) {
      throw new AppError('Source account not found', 404);
    }

    if (body.type === 'TRANSFER') {
      if (!body.toAccountId) {
        throw new AppError('Destination account (toAccountId) is required for transfers', 400);
      }
      if (body.accountId === body.toAccountId) {
        throw new AppError('Source and destination accounts cannot be identical', 400);
      }
      const toAccount = await prisma.financialAccount.findFirst({
        where: { id: body.toAccountId, userId },
      });
      if (!toAccount) {
        throw new AppError('Destination account not found', 404);
      }
    }

    // Deduplication check
    const fingerprintHash = generateTransactionFingerprint({
      userId,
      accountId: body.accountId,
      date: body.date,
      amountPaise: body.amountPaise,
      description: body.description,
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

    // Execute atomic balance update and transaction record creation
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: body.accountId,
          categoryId: body.categoryId || null,
          type: body.type,
          amountPaise: body.amountPaise,
          date: new Date(body.date),
          description: body.description.trim(),
          merchantName: body.merchantName?.trim() || null,
          notes: body.notes?.trim() || null,
          fingerprintHash,
          referenceNumber: body.referenceNumber || null,
          isRecurring: body.isRecurring,
        },
        include: {
          account: true,
          category: true,
        },
      });

      // Update balances based on type
      if (body.type === 'EXPENSE') {
        await tx.financialAccount.update({
          where: { id: body.accountId },
          data: { balancePaise: { decrement: body.amountPaise } },
        });
      } else if (body.type === 'INCOME' || body.type === 'REFUND') {
        await tx.financialAccount.update({
          where: { id: body.accountId },
          data: { balancePaise: { increment: body.amountPaise } },
        });
      } else if (body.type === 'TRANSFER' && body.toAccountId) {
        await tx.financialAccount.update({
          where: { id: body.accountId },
          data: { balancePaise: { decrement: body.amountPaise } },
        });
        await tx.financialAccount.update({
          where: { id: body.toAccountId },
          data: { balancePaise: { increment: body.amountPaise } },
        });
      }

      return transaction;
    }, { maxWait: 10000, timeout: 20000 });

    // Evaluate budget threshold alerts asynchronously
    if (body.type === 'EXPENSE') {
      evaluateBudgetThresholds(prisma, userId).catch((err) =>
        console.error('Threshold alert evaluation failed:', err)
      );
    }

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const query = getTransactionsSchema.parse(req.query);

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.startDate || query.endDate
        ? {
            date: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: 'insensitive' } },
              { merchantName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { date: 'desc' },
        include: {
          account: {
            select: { id: true, name: true, type: true, currency: true, color: true },
          },
          category: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        account: true,
        category: true,
      },
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const body = updateTransactionSchema.parse(req.body);

    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError('Transaction not found', 404);
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.description ? { description: body.description.trim() } : {}),
        ...(body.merchantName !== undefined ? { merchantName: body.merchantName?.trim() || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
        ...(body.referenceNumber !== undefined ? { referenceNumber: body.referenceNumber } : {}),
        ...(body.isRecurring !== undefined ? { isRecurring: body.isRecurring } : {}),
      },
      include: {
        account: true,
        category: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    // Atomic reversal of account balance & deletion
    await prisma.$transaction(async (tx) => {
      if (transaction.type === 'EXPENSE') {
        // Reverse expense: add back to account
        await tx.financialAccount.update({
          where: { id: transaction.accountId },
          data: { balancePaise: { increment: transaction.amountPaise } },
        });
      } else if (transaction.type === 'INCOME' || transaction.type === 'REFUND') {
        // Reverse income: deduct from account
        await tx.financialAccount.update({
          where: { id: transaction.accountId },
          data: { balancePaise: { decrement: transaction.amountPaise } },
        });
      }

      await tx.transaction.delete({
        where: { id },
      });
    }, { maxWait: 10000, timeout: 20000 });

    res.status(200).json({
      success: true,
      data: { message: 'Transaction deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
};
