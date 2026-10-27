import { Router } from 'express';
import {
  getAccounts,
  createAccount,
  updateAccount,
  getAccountById,
} from '../controllers/account.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const accountRouter = Router();

accountRouter.use(requireAuth);

accountRouter.get('/', getAccounts);
accountRouter.post('/', createAccount);
accountRouter.get('/:id', getAccountById);
accountRouter.patch('/:id', updateAccount);
