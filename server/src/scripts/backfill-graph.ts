import { connectDB, pool } from '../db/index.js';
import { graphWorker } from '../services/graph/graph-worker.service.js';
import { logger } from '../utils/logger.js';

async function main() {
  logger.info('[Backfill] Starting manual knowledge graph backfill into Neo4j...');
  await connectDB();

  let totalChunks = 0;
  let totalChats = 0;
  let totalTriples = 0;

  while (true) {
    const result = await graphWorker.processBatch();
    if (result.processedChunks === 0 && result.processedChats === 0) {
      break;
    }
    totalChunks += result.processedChunks;
    totalChats += result.processedChats;
    totalTriples += result.triplesCount;
    logger.info(
      { totalChunks, totalChats, totalTriples },
      '[Backfill] Progress batch completed'
    );
  }

  logger.info(
    { totalChunks, totalChats, totalTriples },
    '[Backfill] Graph backfill finished successfully!'
  );

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '[Backfill] Fatal error during graph backfill');
  process.exit(1);
});
