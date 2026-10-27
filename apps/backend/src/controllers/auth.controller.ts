import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import {
  hashPassword,
  comparePassword,
  generateTokens,
  verifyRefreshToken,
} from '../utils/auth.js';
import { DEFAULT_CATEGORIES } from '../utils/categories.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  currency: z.string().default('INR'),
});

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name, currency } = registerSchema.parse(req.body);

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);

    // Create user along with initial default account & categories in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name.trim(),
          currency: currency.toUpperCase(),
        },
      });

      // Default primary savings account
      await tx.financialAccount.create({
        data: {
          userId: user.id,
          name: 'Primary Savings',
          type: 'SAVINGS',
          balancePaise: BigInt(0),
          currency: user.currency,
          color: '#10B981',
          icon: 'Wallet',
        },
      });

      // Seed standard categories
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat) => ({
          userId: user.id,
          name: cat.name,
          slug: cat.slug,
          color: cat.color,
          icon: cat.icon,
          isDefault: true,
        })),
      });

      return user;
    }, { maxWait: 10000, timeout: 20000 });

    const tokens = generateTokens(newUser.id, newUser.email);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          currency: newUser.currency,
          createdAt: newUser.createdAt,
        },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        accounts: {
          where: { isArchived: false },
          select: {
            id: true,
            name: true,
            type: true,
            balancePaise: true,
            currency: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    const tokens = generateTokens(user.id, user.email);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          currency: user.currency,
          accounts: user.accounts,
        },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    const tokens = generateTokens(user.id, user.email);

    res.status(200).json({
      success: true,
      data: {
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        createdAt: true,
        accounts: {
          where: { isArchived: false },
          select: {
            id: true,
            name: true,
            type: true,
            balancePaise: true,
            currency: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Calculate total net balance across all active accounts
    const totalBalancePaise = user.accounts.reduce((sum, acc) => {
      // Credit cards represent liability / negative contribution if drawn
      if (acc.type === 'CREDIT_CARD') {
        return sum - BigInt(acc.balancePaise);
      }
      return sum + BigInt(acc.balancePaise);
    }, BigInt(0));

    res.status(200).json({
      success: true,
      data: {
        ...user,
        totalBalancePaise: totalBalancePaise.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
