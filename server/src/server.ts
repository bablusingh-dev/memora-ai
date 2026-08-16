import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { pool, connectDB } from './db/index.js';
import { GraphFactory } from './providers/graph/graph.factory.js';
import { MemoryFactory } from './providers/memory/memory.factory.js';
import { graphWorker } from './services/graph/graph-worker.service.js';

async function bootstrap() {
  logger.info('[Startup] Verifying all required services before accepting traffic...');

  // 1. ParadeDB / PostgreSQL
  try {
    await connectDB();
    logger.info('[Startup] [OK] ParadeDB (PostgreSQL) connected');
  } catch (err) {
    logger.fatal({ err }, '[Startup] [FAIL] ParadeDB connection failed - server cannot start');
    process.exit(1);
  }

  // 2. Neo4j
  try {
    const graph = GraphFactory.getProvider();
    await graph.connect();
    logger.info('[Startup] [OK] Neo4j connected');
  } catch (err) {
    logger.fatal({ err }, '[Startup] [FAIL] Neo4j connection failed - server cannot start');
    process.exit(1);
  }

  // 3. Mem0 (self-hosted container or cloud API)
  try {
    const memory = MemoryFactory.getProvider();
    await memory.ping();
    logger.info('[Startup] [OK] Mem0 memory service connected');
  } catch (err) {
    logger.fatal({ err }, '[Startup] [FAIL] Mem0 connection failed - server cannot start');
    process.exit(1);
  }

  // All services healthy — start accepting traffic
  const server = app.listen(env.PORT, () => {
    logger.info(
      `[Server] Server running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`
    );
    logger.info(`[Health] API Health Check available at http://localhost:${env.PORT}/api/v1/health`);

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
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception thrown');
  process.exit(1);
});

bootstrap();
