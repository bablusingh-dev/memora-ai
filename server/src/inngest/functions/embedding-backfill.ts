import { inngest } from '../client.js';
import { DocumentChunkRepository } from '../../repositories/document-chunk.repository.js';
import { embeddingService } from '../../services/embedding.service.js';
import { logger } from '../../utils/logger.js';

const chunkRepo = new DocumentChunkRepository();

/**
 * Populates embeddings for any chunk missing one — the ingestion pipeline's
 * embedding step soft-fails (chunks stay BM25-searchable immediately rather
 * than blocking on an embeddings-API hiccup), and this is what eventually
 * catches those, plus any chunk ingested before hybrid search existed.
 *
 * No onFailure/dead-lettering: unlike a stuck source or chunk, a failed
 * backfill cycle just means chunks stay BM25-only a little longer — the
 * next cron run five minutes later picks the same rows back up automatically
 * (nothing here marks progress on a row until it succeeds).
 */
export const embeddingBackfillFunction = inngest.createFunction(
  { id: 'embedding-backfill', triggers: [{ cron: '*/5 * * * *' }] },
  async ({ step }) => {
    const missing = await step.run('find-missing-embeddings', () => chunkRepo.findMissingEmbeddings(200));
    if (missing.length === 0) return { embedded: 0 };

    const embedded = await step.run('generate-and-persist-embeddings', async () => {
      const embeddings = await embeddingService.embedMany(missing.map((c) => c.retrievalContent || c.content));
      await Promise.all(missing.map((c, i) => chunkRepo.updateEmbedding(c.id, embeddings[i])));
      return missing.length;
    });

    logger.info({ embedded }, '[EmbeddingBackfill] Backfilled embeddings for chunks missing them');
    return { embedded };
  }
);
