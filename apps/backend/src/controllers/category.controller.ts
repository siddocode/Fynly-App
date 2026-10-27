import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  color: z.string().default('#6366F1'),
  icon: z.string().default('Tag'),
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
    const { name, color, icon } = createCategorySchema.parse(req.body);

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

    const category = await prisma.category.create({
      data: {
        userId,
        name: name.trim(),
        slug,
        color,
        icon,
        isDefault: false,
      },
    });

    res.status(201).json({
      success: true,
      data: category,
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
      where: { id, userId },
    });

    if (!category) {
      throw new AppError('Category not found or cannot be deleted', 404);
    }

    await prisma.category.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      data: { message: 'Category deleted' },
    });
  } catch (error) {
    next(error);
  }
};
