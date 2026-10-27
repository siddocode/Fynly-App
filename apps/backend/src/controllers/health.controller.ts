import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'fynly-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
    },
  });
};

export const getDbHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        status: 'connected',
        database: 'postgresql',
        latencyMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
