import { Router } from 'express';
import { getHealth, getDbHealth } from '../controllers/health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/db', getDbHealth);
