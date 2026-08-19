import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sourceDocuments, documentChunks } from '../db/schema.js';

export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type NewSourceDocument = typeof sourceDocuments.$inferInsert;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;

/** Postgres unique_violation error code (used to detect content-hash races). */
export const UNIQUE_VIOLATION = '23505';

/**
 * Postgres text columns reject the null byte (U+0000) outright — extraction
 * from PDFs/DOCX (and occasionally scraped HTML) can yield embedded \0s on
 * malformed or partially-binary content, which otherwise surfaces as an
 * opaque "invalid byte sequence for encoding UTF8" (22021) error deep in the
 * insert. Strip them from every string field before they reach the driver.
 */
function stripNullBytes<T extends Record<string, unknown>>(row: T): T {
  const cleaned: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(cleaned)) {
    if (typeof value === 'string' && value.indexOf('\u0000') !== -1) {
      cleaned[key] = value.replace(/\u0000/g, '');
    }
  }
  return cleaned as T;
}

export class SourceRepository {
  async findById(id: string): Promise<SourceDocument | null> {
    const result = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, id)).limit(1);
    return result[0] || null;
  }

  async findByMemorybookId(memorybookId: string): Promise<SourceDocument[]> {
    return await db
      .select()
      .from(sourceDocuments)
      .where(eq(sourceDocuments.memorybookId, memorybookId))
      .orderBy(sourceDocuments.createdAt);
  }

  /**
   * Find an existing source with the same content hash in this memorybook —
   * the authoritative dedup check. Callers should also handle a unique_violation
   * (23505) from `createSource`/`updateSource` as the race-condition backstop
   * for two concurrent ingestions of identical content (see
   * idx_source_documents_memorybook_hash in db/index.ts).
   */
  async findByContentHash(memorybookId: string, contentHash: string): Promise<SourceDocument | null> {
    const result = await db
      .select()
      .from(sourceDocuments)
      .where(and(eq(sourceDocuments.memorybookId, memorybookId), eq(sourceDocuments.contentHash, contentHash)))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Find an in-flight or completed source with the same URL in this memorybook.
   * Used as a cheap synchronous pre-check for website/YouTube ingestion,
   * where the content (and therefore its hash) isn't known until the async
   * pipeline fetches it — this only catches the common "double click" case,
   * not genuine races; the content-hash unique index is the real backstop.
   */
  async findActiveByUrl(memorybookId: string, fileUrl: string): Promise<SourceDocument | null> {
    const result = await db
      .select()
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.memorybookId, memorybookId),
          eq(sourceDocuments.fileUrl, fileUrl)
        )
      )
      .limit(5);
    return result.find((s) => s.status === 'processing' || s.status === 'ready') || null;
  }

  async createSource(data: NewSourceDocument): Promise<SourceDocument> {
    const result = await db.insert(sourceDocuments).values(data).returning();
    return result[0];
  }

  /**
   * General-purpose partial update — status, stage, errorMessage, title,
   * contentHash, etc. Replaces the old single-purpose `updateSourceStatus`
   * now that the ingestion pipeline needs to update several independent
   * fields at different points (queued/processing/ready/error/duplicate,
   * pipeline stage, failure reason, discovered title).
   */
  async updateSource(id: string, data: Partial<NewSourceDocument>): Promise<SourceDocument | null> {
    const result = await db.update(sourceDocuments).set(data).where(eq(sourceDocuments.id, id)).returning();
    return result[0] || null;
  }

  /**
   * All chunks across every source in a memorybook, ordered per-document
   * (sourceId, then chunkIndex) rather than by search relevance — used by
   * Studio artifact generation (studio-context.service.ts), which needs a
   * coherent read of "everything in this memorybook", not a query-ranked
   * top-K like searchHybrid.
   */
  async findChunksByMemorybookId(memorybookId: string): Promise<DocumentChunk[]> {
    return await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.memorybookId, memorybookId))
      .orderBy(asc(documentChunks.sourceId), asc(documentChunks.chunkIndex));
  }

  async insertChunks(chunks: NewDocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    await db.insert(documentChunks).values(chunks.map(stripNullBytes));
  }

  /**
   * Same as `insertChunks` but returns the generated chunk IDs, needed to
   * fan out one `graph/chunk.created` event per chunk after ingestion.
   */
  async insertChunksReturningIds(chunks: NewDocumentChunk[]): Promise<string[]> {
    if (chunks.length === 0) return [];
    const result = await db
      .insert(documentChunks)
      .values(chunks.map(stripNullBytes))
      .returning({ id: documentChunks.id });
    return result.map((r) => r.id);
  }

  /**
   * Delete all chunks for a source. Used to make the ingestion pipeline's
   * persist step idempotent against a full function-level retry (Inngest
   * memoizes individual step results within one run, but a retry that starts
   * a brand-new run after exhausting step retries would otherwise duplicate
   * chunks on re-insert).
   */
  async deleteChunksBySourceId(sourceId: string): Promise<void> {
    await db.delete(documentChunks).where(eq(documentChunks.sourceId, sourceId));
  }

  async deleteSource(id: string, memorybookId: string): Promise<boolean> {
    const result = await db
      .delete(sourceDocuments)
      .where(and(eq(sourceDocuments.id, id), eq(sourceDocuments.memorybookId, memorybookId)))
      .returning();
    return result.length > 0;
  }
}
