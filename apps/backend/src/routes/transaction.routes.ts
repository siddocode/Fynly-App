import { Router } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  clearTransactions,
} from '../controllers/transaction.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const transactionRouter = Router();

transactionRouter.use(requireAuth);

transactionRouter.post('/', createTransaction);
transactionRouter.get('/', getTransactions);
transactionRouter.delete('/history/clear', clearTransactions);
transactionRouter.get('/:id', getTransactionById);
transactionRouter.patch('/:id', updateTransaction);
transactionRouter.delete('/:id', deleteTransaction);

