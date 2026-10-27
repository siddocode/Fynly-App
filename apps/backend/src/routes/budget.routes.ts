import { Router } from 'express';
import {
  createOrUpdateBudget,
  getBudgets,
  deleteBudget,
} from '../controllers/budget.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const budgetRouter = Router();

budgetRouter.use(requireAuth);

budgetRouter.post('/', createOrUpdateBudget);
budgetRouter.get('/', getBudgets);
budgetRouter.delete('/:id', deleteBudget);
