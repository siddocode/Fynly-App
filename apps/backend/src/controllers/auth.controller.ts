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
import { sendWelcomeEmail, sendOtpEmail } from '../utils/email.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  currency: z.string().default('INR'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Please enter a valid email address'),
  purpose: z.enum(['REGISTER', 'LOGIN']),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Please enter a valid email address'),
  otp: z.string().trim().length(6, 'Verification code must be 6 digits'),
  purpose: z.enum(['REGISTER', 'LOGIN']),
  name: z.string().optional(),
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
      throw new AppError('An account with this email already exists. Please sign in instead.', 409);
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

    // Send transactional welcome email via Brevo
    sendWelcomeEmail({ email: newUser.email, name: newUser.name });

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

    if (!user.passwordHash) {
      throw new AppError('This account was created via OTP. Please sign in with OTP.', 400);
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

export const sendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, purpose } = sendOtpSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (purpose === 'LOGIN' && !existingUser) {
      throw new AppError('No account found with this email. Please register first.', 404);
    }

    if (purpose === 'REGISTER' && existingUser) {
      throw new AppError('An account with this email already exists. Please select Sign In to log in.', 409);
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous unused OTPs for this email & purpose
    await prisma.verificationOtp.deleteMany({
      where: { email, purpose },
    });

    // Create fresh OTP record
    await prisma.verificationOtp.create({
      data: {
        email,
        otp,
        purpose,
        expiresAt,
      },
    });

    // Clear console output for easy dev verification
    console.log(`\n========================================`);
    console.log(`[AUTH-OTP] Code for ${email} (${purpose}): ${otp}`);
    console.log(`========================================\n`);

    // Send email via Brevo (non-blocking resilience)
    sendOtpEmail(email, otp, purpose).catch((err) => {
      console.warn('[Brevo] Dispatch error (check daily free quota):', err);
    });

    const isDev = process.env.NODE_ENV !== 'production';

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${email}`,
      data: {
        email,
        purpose,
        ...(isDev ? { debugOtp: otp } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp, purpose, name } = verifyOtpSchema.parse(req.body);

    const record = await prisma.verificationOtp.findFirst({
      where: {
        email,
        otp,
        purpose,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new AppError('Invalid or expired verification code. Please request a new one.', 400);
    }

    // Mark OTP as used
    await prisma.verificationOtp.update({
      where: { id: record.id },
      data: { used: true },
    });

    let user = await prisma.user.findUnique({
      where: { email },
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

    if (purpose === 'LOGIN') {
      if (!user) {
        throw new AppError('No account found with this email. Please register first.', 404);
      }
    } else {
      // REGISTER purpose
      if (user) {
        // If account already existed, log them in seamlessly
      } else {
        const displayName = (name && name.trim().length > 0) ? name.trim() : email.split('@')[0];
        
        user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email,
              name: displayName,
              currency: 'INR',
            },
          });

          await tx.financialAccount.create({
            data: {
              userId: created.id,
              name: 'Primary Savings',
              type: 'SAVINGS',
              balancePaise: BigInt(0),
              currency: created.currency,
              color: '#10B981',
              icon: 'Wallet',
            },
          });

          await tx.category.createMany({
            data: DEFAULT_CATEGORIES.map((cat) => ({
              userId: created.id,
              name: cat.name,
              slug: cat.slug,
              color: cat.color,
              icon: cat.icon,
              isDefault: true,
            })),
          });

          return created as any;
        }, { maxWait: 10000, timeout: 20000 });

        if (user) {
          sendWelcomeEmail({ email: user.email, name: user.name });
        }
      }
    }

    if (!user) {
      throw new AppError('Could not authenticate user', 500);
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
          accounts: user.accounts || [],
        },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

