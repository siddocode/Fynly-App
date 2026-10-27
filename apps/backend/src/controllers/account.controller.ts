import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['SAVINGS', 'CURRENT', 'CREDIT_CARD', 'WALLET', 'CASH']).default('SAVINGS'),
  initialBalancePaise: z.union([z.number(), z.string()]).default(0).transform((val) => BigInt(val)),
  currency: z.string().default('INR'),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isArchived: z.boolean().optional(),
});

export const getAccounts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const accounts = await prisma.financialAccount.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, type, initialBalancePaise, currency, color, icon } =
      createAccountSchema.parse(req.body);

    const account = await prisma.financialAccount.create({
      data: {
        userId,
        name: name.trim(),
        type,
        balancePaise: initialBalancePaise,
        currency,
        color: color || '#10B981',
        icon: icon || 'Wallet',
      },
    });

    res.status(201).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = updateAccountSchema.parse(req.body);

    const account = await prisma.financialAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const updated = await prisma.financialAccount.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const account = await prisma.financialAccount.findFirst({
      where: { id, userId },
      include: {
        transactions: {
          take: 10,
          orderBy: { date: 'desc' },
          include: { category: true },
        },
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};
