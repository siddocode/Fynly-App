import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/auth.js';
import { AppError } from './error.middleware.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const requireAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Authentication required. Missing Bearer token.', 401));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired authentication token', 401));
  }
};
