import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notebooks, sourceDocuments, documentChunks } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { fuseRankedLists, RankedItem } from '../utils/rrf.js';

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
      logger.error(
        { error, notebookId, query: cleanQuery },
        'ParadeDB BM25 search failed — falling back to ILIKE substring search'
      );
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

    const rankedLists: RankedItem<any>[][] = searchResults.map((rows) =>
      rows.map((row: any) => ({ id: String(row.id), item: row }))
    );
    const fused = fuseRankedLists(rankedLists, limit);

    return fused.map(({ item, rrfScore }) => ({
      ...item,
      bm25_score: rrfScore * 100, // Normalized for display
    }));
  }

  /**
   * Semantic search over chunk embeddings via pgvector cosine distance
   * (`<=>`). Returns [] (not a throw) on any failure — missing extension,
   * no embedded chunks yet, etc. — so callers can treat "no vector results"
   * as a normal degrade-to-BM25-only case rather than an error to handle.
   */
  async searchVector(notebookId: string, queryEmbedding: number[], limit = 5): Promise<any[]> {
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    try {
      const result = await db.execute(sql`
        SELECT
          id, source_id, notebook_id, content,
          COALESCE(retrieval_content, content) AS retrieval_content,
          heading, section_path, chunk_index,
          1 - (embedding <=> ${vectorLiteral}::vector) AS vector_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorLiteral}::vector ASC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      logger.error(
        { error, notebookId },
        'pgvector search failed — hybrid retrieval will degrade to BM25-only for this query'
      );
      return [];
    }
  }

  /**
   * Primary document-layer retrieval: multi-query BM25 (lexical, handles
   * exact terms/keywords the query-enhancer expanded) fused via RRF with
   * pgvector cosine search (semantic, catches paraphrases with no lexical
   * overlap) — two independently-ranked lists blended 50/50 by rank, not by
   * raw score, which is what makes RRF appropriate for combining BM25 scores
   * with cosine similarities that live on entirely different scales.
   *
   * `queryEmbedding` is nullable: when embedding generation fails at query
   * time (see EmbeddingService#embedQuerySafe) or no chunks in this notebook
   * have been embedded yet, this transparently falls back to BM25-only
   * rather than failing the chat turn.
   */
  async searchHybrid(notebookId: string, queries: string[], queryEmbedding: number[] | null, limit = 5): Promise<any[]> {
    const [bm25Rows, vectorRows] = await Promise.all([
      this.searchMultiQueryBM25(notebookId, queries, limit * 2),
      queryEmbedding ? this.searchVector(notebookId, queryEmbedding, limit * 2) : Promise.resolve([]),
    ]);

    if (vectorRows.length === 0) {
      return bm25Rows.slice(0, limit);
    }

    const bm25Ranked: RankedItem<any>[] = bm25Rows.map((row: any) => ({ id: String(row.id), item: row }));
    const vectorRanked: RankedItem<any>[] = vectorRows.map((row: any) => ({ id: String(row.id), item: row }));

    const fused = fuseRankedLists([bm25Ranked, vectorRanked], limit);
    return fused.map(({ item, rrfScore }) => ({ ...item, bm25_score: rrfScore * 100 }));
  }
}

