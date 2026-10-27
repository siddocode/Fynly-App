import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notificationEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notificationEvent.count({
        where: { userId, isRead: false },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    if (id === 'all') {
      await prisma.notificationEvent.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      res.status(200).json({
        success: true,
        data: { message: 'All notifications marked as read' },
      });
      return;
    }

    const notification = await prisma.notificationEvent.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    const updated = await prisma.notificationEvent.update({
      where: { id },
      data: { isRead: true },
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const clearNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    await prisma.notificationEvent.deleteMany({
      where: { userId, isRead: true },
    });

    res.status(200).json({
      success: true,
      data: { message: 'Read notifications cleared' },
    });
  } catch (error) {
    next(error);
  }
};
