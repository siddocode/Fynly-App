import { Router } from 'express';
import {
  createTracker,
  getTrackers,
  getTrackerById,
  updateTracker,
  addTrackerExpense,
  endTracker,
  deleteTracker,
  deleteTrackerExpense,
} from '../controllers/tracker.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const trackerRouter = Router();

trackerRouter.use(requireAuth);

trackerRouter.post('/', createTracker);
trackerRouter.get('/', getTrackers);
trackerRouter.get('/:id', getTrackerById);
trackerRouter.patch('/:id', updateTracker);
trackerRouter.post('/:id/expenses', addTrackerExpense);
trackerRouter.delete('/:id/expenses/:transactionId', deleteTrackerExpense);
trackerRouter.post('/:id/end', endTracker);
trackerRouter.delete('/:id', deleteTracker);
