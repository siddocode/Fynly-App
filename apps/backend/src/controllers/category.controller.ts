import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  color: z.string().default('#6366F1'),
  icon: z.string().default('Tag'),
  limitPaise: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => (val !== undefined && val !== null && String(val).trim() !== '' && BigInt(val) > 0n ? BigInt(val) : null)),
});

export const getCategories = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const categories = await prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isDefault: true }],
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, color, icon, limitPaise } = createCategorySchema.parse(req.body);

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-');

    const existing = await prisma.category.findFirst({
      where: { userId, slug },
    });

    if (existing) {
      throw new AppError('A category with this name already exists', 409);
    }

    // If money/limit is provided, check against active budget ceiling if one exists
    let activeBudget = null;
    if (limitPaise) {
      activeBudget = await prisma.budget.findFirst({
        where: { userId, isActive: true },
        include: { categories: true },
      });

      if (activeBudget) {
        const currentAllocated = activeBudget.categories.reduce(
          (sum, c) => sum + BigInt(c.limitPaise),
          0n
        );
        const availableBuffer = activeBudget.limitPaise > currentAllocated
          ? activeBudget.limitPaise - currentAllocated
          : 0n;

        if (limitPaise > availableBuffer) {
          throw new AppError(
            `Cannot allocate money: overall budget limit reached or exceeded (available: ₹${Number(availableBuffer) / 100})`,
            400
          );
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          userId,
          name: name.trim(),
          slug,
          color,
          icon,
          isDefault: false,
        },
      });

      if (limitPaise && activeBudget) {
        await tx.budgetCategory.create({
          data: {
            budgetId: activeBudget.id,
            categoryId: category.id,
            limitPaise,
          },
        });
      }

      return category;
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const category = await prisma.category.findFirst({
      where: {
        id,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    await prisma.category.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      data: { message: 'Category deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
};
