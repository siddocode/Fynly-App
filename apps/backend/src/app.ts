import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { errorHandler, AppError } from './middleware/error.middleware.js';

export const createApp = () => {
  const app = express();

  // Basic Middleware
  app.use(cors({
    origin: env.CLIENT_ORIGIN === '*' ? '*' : env.CLIENT_ORIGIN.split(','),
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health routes mounted directly and under API_PREFIX
  app.use('/health', healthRouter);
  app.use(`${env.API_PREFIX}/health`, healthRouter);

  // Catch-all 404 handler
  app.use((_req, _res, next) => {
    next(new AppError('Endpoint not found', 404));
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
};
