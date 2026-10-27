import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { accountRouter } from './routes/account.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { transactionRouter } from './routes/transaction.routes.js';
import { errorHandler, AppError } from './middleware/error.middleware.js';

export const createApp = () => {
  const app = express();

  // Middleware
  app.use(cors({
    origin: env.CLIENT_ORIGIN === '*' ? '*' : env.CLIENT_ORIGIN.split(','),
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Root & Health
  app.use('/health', healthRouter);
  app.use(`${env.API_PREFIX}/health`, healthRouter);

  // Core API Routes
  app.use(`${env.API_PREFIX}/auth`, authRouter);
  app.use(`${env.API_PREFIX}/accounts`, accountRouter);
  app.use(`${env.API_PREFIX}/categories`, categoryRouter);
  app.use(`${env.API_PREFIX}/transactions`, transactionRouter);

  // Catch-all 404 handler
  app.use((_req, _res, next) => {
    next(new AppError('Endpoint not found', 404));
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
};
