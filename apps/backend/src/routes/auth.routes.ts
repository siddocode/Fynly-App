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

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/send-otp', sendOtp);
authRouter.post('/verify-otp', verifyOtp);
authRouter.post('/refresh', refresh);
authRouter.get('/me', requireAuth, getMe);

