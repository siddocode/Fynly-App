import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Fynly backend listening on http://localhost:${env.PORT}`);
  console.log(`🏥 Health check at http://localhost:${env.PORT}/health`);
  console.log(`🌐 API prefix mounted at ${env.API_PREFIX}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
