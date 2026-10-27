import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  clearNotifications,
} from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/', getNotifications);
notificationRouter.patch('/:id/read', markAsRead);
notificationRouter.delete('/read', clearNotifications);
