import { Router } from 'express';
import {
  previewStatement,
  importStatement,
} from '../controllers/statement.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const statementRouter = Router();

statementRouter.use(requireAuth);

statementRouter.post('/preview', previewStatement);
statementRouter.post('/import', importStatement);
