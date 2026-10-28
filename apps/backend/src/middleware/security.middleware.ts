import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env.js';

/**
 * Helmet Security Headers Middleware
 * Protects against common web vulnerabilities (XSS, Clickjacking, MIME sniffing).
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // REST APIs do not render HTML templates
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * General API Rate Limiter
 * Provides broad DOS protection while remaining generous for mobile API clients.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 10000 : 2000, // High throughput
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again in 15 minutes.',
    },
  },
});

/**
 * Auth Rate Limiter (Login, Register)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 10000 : 300, // Generous limit for authentication
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again in 15 minutes.',
    },
  },
});

/**
 * OTP Generation & Verification Rate Limiter
 * Specifically tuned to NOT be overly strict per testing requirements.
 * Allows generous attempts so developers & testers never get locked out.
 */
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 100 : 500, // Very generous during testing/development
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Completely bypass in automated tests or local localhost development if desired
    return env.NODE_ENV === 'test';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'OTP request limit reached. Please wait a moment before requesting another code.',
      },
    });
  },
});
