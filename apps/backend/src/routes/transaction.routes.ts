import { Router } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from '../controllers/transaction.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const transactionRouter = Router();

transactionRouter.use(requireAuth);

transactionRouter.post('/', createTransaction);
transactionRouter.get('/', getTransactions);
transactionRouter.get('/:id', getTransactionById);
transactionRouter.patch('/:id', updateTransaction);
transactionRouter.delete('/:id', deleteTransaction);
