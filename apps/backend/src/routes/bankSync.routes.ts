import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getSupportedInstitutions,
  getBankSyncStatus,
} from '../controllers/bankSync.controller.js';

export const bankSyncRouter = Router();

bankSyncRouter.use(requireAuth);

bankSyncRouter.get('/providers', getSupportedInstitutions);
bankSyncRouter.get('/status', getBankSyncStatus);
