import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getInsightsOverview,
  getRecurringSubscriptions,
  getSpendingTrends,
} from '../controllers/analytics.controller.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get('/overview', getInsightsOverview);
analyticsRouter.get('/recurring', getRecurringSubscriptions);
analyticsRouter.get('/trends', getSpendingTrends);
