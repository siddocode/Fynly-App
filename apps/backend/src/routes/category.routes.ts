import { Router } from 'express';
import {
  getCategories,
  createCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const categoryRouter = Router();

categoryRouter.use(requireAuth);

categoryRouter.get('/', getCategories);
categoryRouter.post('/', createCategory);
categoryRouter.delete('/:id', deleteCategory);
