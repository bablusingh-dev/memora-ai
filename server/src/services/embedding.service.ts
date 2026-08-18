import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** OpenAI text-embedding-3-small output dimensionality — must match the
 * `vector(1536)` column definition in db/schema.ts. */
export const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MODEL_ID = 'text-embedding-3-small';

// OpenAI's embeddings endpoint accepts up to 2048 inputs per request, but we
// batch conservatively so a single failed/retried batch (Inngest step) never
// covers more than a small, fast slice of a large ingestion.
const BATCH_SIZE = 96;

/**
 * Wraps `embed`/`embedMany` from the `ai` SDK for both ingestion-time
 * (batch, many chunks) and query-time (single, the corrected user query)
 * embedding generation — the two call sites that need vectors for hybrid
 * BM25 + pgvector retrieval (see notebook.repository.ts#searchHybrid).
 */
export class EmbeddingService {
  private openai: ReturnType<typeof createOpenAI>;

  constructor() {
    this.openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  /** Embed a single string (query-time use). */
  async embedOne(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: this.openai.embeddingModel(EMBEDDING_MODEL_ID),
      value: text,
    });
    return embedding;
  }

  /**
   * Embed many strings (ingestion-time use), batched at BATCH_SIZE and run
   * sequentially per batch — predictable, observable failure boundaries
   * rather than one giant all-or-nothing call. Returns embeddings in the
   * same order as the input texts.
   */
  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const { embeddings } = await embedMany({
        model: this.openai.embeddingModel(EMBEDDING_MODEL_ID),
        values: batch,
      });
      results.push(...embeddings);
    }
    return results;
  }

  /**
   * Query-time embedding with a soft failure mode: returns null instead of
   * throwing, so callers can fall back to BM25-only for that turn rather
   * than failing the whole chat turn over a transient embeddings-API hiccup.
   */
  async embedQuerySafe(text: string): Promise<number[] | null> {
    try {
      return await this.embedOne(text);
    } catch (err) {
      logger.warn({ err }, '[EmbeddingService] Query embedding failed — falling back to BM25-only for this turn');
      return null;
    }
  }
}

export const embeddingService = new EmbeddingService();
