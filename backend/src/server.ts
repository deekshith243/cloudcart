import 'dotenv/config';
import { app } from './app.js';
import { redisCache } from './services/redis-service.js';

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
void redisCache.connect();
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`CloudCart API listening on port ${port}`);
});

const shutdown = (signal: string) => {
  console.log(`Received ${signal}; shutting down API`);
  server.close(() => {
    void redisCache.disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
