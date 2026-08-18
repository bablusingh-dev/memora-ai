import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documentChunks, notebooks } from '../db/schema.js';

export interface ChunkForGraphExtraction {
  id: string;
  notebookId: string;
  userId: string;
  content: string;
  retrievalContent: string | null;
  heading: string | null;
  sectionPath: string | null;
}

export interface PendingGraphIndexChunk {
  id: string;
  notebookId: string;
  userId: string;
}

/**
 * document_chunks lifecycle concerns that don't belong in SourceRepository
 * (chunk creation/persistence) or NotebookRepository (BM25/vector search) —
 * specifically the knowledge-graph indexing state machine driven by the
 * event-driven Inngest pipeline in inngest/functions/graph-extract.ts.
 */
export class DocumentChunkRepository {
  /**
   * Fetch one chunk plus its owning user (joined from notebooks) — everything
   * the graph extraction step needs, in the shape the LLM extraction prompt
   * and Neo4j provider expect.
   */
  async findForGraphExtraction(chunkId: string): Promise<ChunkForGraphExtraction | null> {
    const result = await db
      .select({
        id: documentChunks.id,
        notebookId: documentChunks.notebookId,
        userId: notebooks.userId,
        content: documentChunks.content,
        retrievalContent: documentChunks.retrievalContent,
        heading: documentChunks.heading,
        sectionPath: documentChunks.sectionPath,
      })
      .from(documentChunks)
      .innerJoin(notebooks, eq(documentChunks.notebookId, notebooks.id))
      .where(eq(documentChunks.id, chunkId))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Chunks still awaiting graph extraction. Used by the backfill cron as a
   * safety net (catches chunks whose fan-out event was somehow lost) and as
   * the on-ramp for the pre-Inngest backlog of un-indexed chunks — not the
   * primary path, which is the per-chunk `graph/chunk.created` event fired
   * directly from the ingestion pipeline.
   */
  async findPendingGraphIndexChunks(limit = 200): Promise<PendingGraphIndexChunk[]> {
    return db
      .select({ id: documentChunks.id, notebookId: documentChunks.notebookId, userId: notebooks.userId })
      .from(documentChunks)
      .innerJoin(notebooks, eq(documentChunks.notebookId, notebooks.id))
      .where(eq(documentChunks.graphIndexStatus, 'pending'))
      .limit(limit);
  }

  /** Marks a chunk in-flight so the backfill cron's next run doesn't re-select it. */
  async markGraphIndexing(chunkId: string): Promise<void> {
    await db.update(documentChunks).set({ graphIndexStatus: 'processing' }).where(eq(documentChunks.id, chunkId));
  }

  async markGraphIndexed(chunkId: string): Promise<void> {
    await db
      .update(documentChunks)
      .set({ graphIndexStatus: 'indexed', isGraphIndexed: true, graphIndexError: null })
      .where(eq(documentChunks.id, chunkId));
  }

  /**
   * Terminal failure after Inngest exhausts all retries — visible and
   * queryable (graph_index_status = 'failed'), unlike the old poller which
   * silently marked bad chunks "indexed" just to stop retrying them.
   */
  async markGraphIndexFailed(chunkId: string, errorMessage: string): Promise<void> {
    await db
      .update(documentChunks)
      .set({
        graphIndexStatus: 'failed',
        graphIndexError: errorMessage.slice(0, 500),
        graphIndexAttempts: sql`${documentChunks.graphIndexAttempts} + 1`,
      })
      .where(eq(documentChunks.id, chunkId));
  }
}
