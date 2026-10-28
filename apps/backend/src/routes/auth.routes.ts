import { Router } from 'express';
import {
  register,
  login,
  refresh,
  getMe,
  sendOtp,
  verifyOtp,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authRateLimiter, otpRateLimiter } from '../middleware/security.middleware.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, register);
authRouter.post('/login', authRateLimiter, login);
authRouter.post('/send-otp', otpRateLimiter, sendOtp);
authRouter.post('/verify-otp', otpRateLimiter, verifyOtp);
authRouter.post('/refresh', authRateLimiter, refresh);
authRouter.get('/me', requireAuth, getMe);


