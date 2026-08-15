import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { pool, connectDB } from './db/index.js';
import { graphWorker } from './services/graph/graph-worker.service.js';

const server = app.listen(env.PORT, async () => {
  logger.info(
    `[Server] Server running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`
  );
  logger.info(`[Health] API Health Check available at http://localhost:${env.PORT}/api/v1/health`);
  
  // Verify database connection & log status
  await connectDB();

  // Start background Neo4j knowledge graph worker
  graphWorker.start(10000);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  graphWorker.stop();

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await pool.end();
      logger.info('PostgreSQL pool connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error closing database pool');
      process.exit(1);
    }
  });

  // Force shutdown after 10s if graceful fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception thrown');
  process.exit(1);
});
