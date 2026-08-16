import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notebooks, sourceDocuments, documentChunks } from '../db/schema.js';

export type Notebook = typeof notebooks.$inferSelect;
export type NewNotebook = typeof notebooks.$inferInsert;
export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;

export class NotebookRepository {
  async findById(id: string, userId: string): Promise<Notebook | null> {
    const result = await db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .limit(1);
    return result[0] || null;
  }

  async findAllByUserId(userId: string): Promise<Notebook[]> {
    return await db
      .select()
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(notebooks.createdAt);
  }

  async create(data: NewNotebook): Promise<Notebook> {
    const result = await db.insert(notebooks).values(data).returning();
    return result[0];
  }

  async update(id: string, userId: string, data: Partial<NewNotebook>): Promise<Notebook | null> {
    const result = await db
      .update(notebooks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getSourcesByNotebookId(notebookId: string): Promise<SourceDocument[]> {
    return await db
      .select()
      .from(sourceDocuments)
      .where(eq(sourceDocuments.notebookId, notebookId));
  }

  /**
   * Search chunks using ParadeDB BM25 pg_search algorithmic indexing.
   * Searches retrieval_content (context-enriched) when present, falling back to content.
   * Returns heading and section_path for structured citations.
   */
  async searchBM25(notebookId: string, query?: string, limit = 5): Promise<any[]> {
    const cleanQuery = query?.trim();

    if (!cleanQuery) {
      const result = await db.execute(sql`
        SELECT
          id, source_id, notebook_id, content,
          COALESCE(retrieval_content, content) AS retrieval_content,
          heading, section_path, chunk_index,
          1.0 AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId}
        ORDER BY chunk_index ASC
        LIMIT ${limit}
      `);
      return result.rows;
    }

    try {
      // Search retrieval_content first (context-enriched); fall back to content for old chunks
      const result = await db.execute(sql`
        SELECT
          id, source_id, notebook_id, content,
          COALESCE(retrieval_content, content) AS retrieval_content,
          heading, section_path, chunk_index,
          paradedb.score(id) AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId}
          AND (
            (retrieval_content IS NOT NULL AND retrieval_content @@@ ${cleanQuery})
            OR
            (retrieval_content IS NULL AND content @@@ ${cleanQuery})
          )
        ORDER BY bm25_score DESC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      const fallbackResult = await db.execute(sql`
        SELECT
          id, source_id, notebook_id, content,
          COALESCE(retrieval_content, content) AS retrieval_content,
          heading, section_path, chunk_index,
          1.0 AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId}
          AND (
            retrieval_content ILIKE ${'%' + cleanQuery + '%'}
            OR content ILIKE ${'%' + cleanQuery + '%'}
          )
        LIMIT ${limit}
      `);
      return fallbackResult.rows;
    }
  }

  /**
   * Search multiple expanded queries in parallel and fuse rankings with Reciprocal Rank Fusion (RRF)
   */
  async searchMultiQueryBM25(notebookId: string, queries: string[], limit = 5): Promise<any[]> {
    const validQueries = queries.map((q) => q.trim()).filter((q) => q.length > 0);
    if (validQueries.length === 0) {
      return await this.searchBM25(notebookId, undefined, limit);
    }

    if (validQueries.length === 1) {
      return await this.searchBM25(notebookId, validQueries[0], limit);
    }

    // Execute BM25 search for each expanded query term
    const searchPromises = validQueries.map((q) => this.searchBM25(notebookId, q, limit * 2));
    const searchResults = await Promise.all(searchPromises);

    // Compute Reciprocal Rank Fusion (RRF) scores
    const k = 60;
    const rrfScores = new Map<string, { chunk: any; rrfScore: number }>();

    for (const rows of searchResults) {
      rows.forEach((row: any, rank: number) => {
        const id = String(row.id);
        const existing = rrfScores.get(id);
        const scoreContribution = 1 / (k + rank + 1);

        if (existing) {
          existing.rrfScore += scoreContribution;
        } else {
          rrfScores.set(id, {
            chunk: row,
            rrfScore: scoreContribution,
          });
        }
      });
    }

    // Sort descending by RRF score
    const fused = Array.from(rrfScores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit)
      .map((item) => ({
        ...item.chunk,
        bm25_score: item.rrfScore * 100, // Normalized for display
      }));

    return fused;
  }
}

