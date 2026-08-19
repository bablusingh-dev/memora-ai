import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { memorybooks, sourceDocuments, documentChunks } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { fuseRankedLists, RankedItem } from '../utils/rrf.js';

export type Memorybook = typeof memorybooks.$inferSelect;
export type NewMemorybook = typeof memorybooks.$inferInsert;
export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;

/** Max length (chars) of a query passed to ParadeDB's BM25 `@@@` operator. */
const BM25_QUERY_MAX_LENGTH = 200;

/**
 * Sanitize a query string before it's used with ParadeDB's BM25 `@@@`
 * operator.
 *
 * `@@@` parses its right-hand side with tantivy's query DSL, which gives
 * special meaning to punctuation like `: + - ! ( ) [ ] { } ^ " ~ * ?` and to
 * em/en-dashes, and treats `AND`/`OR`/`NOT` as boolean operators. Natural
 * language queries — especially ones rewritten by an LLM query-enhancer into
 * long, punctuation-heavy sentences — can trip this parser and raise a
 * Postgres XX000 error, which silently degrades search to a plain ILIKE
 * fallback. Stripping DSL-significant characters and capping length keeps
 * BM25 usable instead of falling back.
 */
function sanitizeBM25Query(query: string): string {
  const cleaned = query
    .normalize('NFKC')
    // Keep letters, digits, and whitespace; drop everything else (dashes,
    // em-dashes, colons, quotes, parens, and other tantivy DSL syntax).
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+(AND|OR|NOT)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > BM25_QUERY_MAX_LENGTH
    ? cleaned.slice(0, BM25_QUERY_MAX_LENGTH).trim()
    : cleaned;
}

export class MemorybookRepository {
  async findById(id: string, userId: string): Promise<Memorybook | null> {
    const result = await db
      .select()
      .from(memorybooks)
      .where(and(eq(memorybooks.id, id), eq(memorybooks.userId, userId)))
      .limit(1);
    return result[0] || null;
  }

  async findAllByUserId(userId: string): Promise<Memorybook[]> {
    return await db
      .select()
      .from(memorybooks)
      .where(eq(memorybooks.userId, userId))
      .orderBy(memorybooks.createdAt);
  }

  async create(data: NewMemorybook): Promise<Memorybook> {
    const result = await db.insert(memorybooks).values(data).returning();
    return result[0];
  }

  async update(id: string, userId: string, data: Partial<NewMemorybook>): Promise<Memorybook | null> {
    const result = await db
      .update(memorybooks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(memorybooks.id, id), eq(memorybooks.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(memorybooks)
      .where(and(eq(memorybooks.id, id), eq(memorybooks.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getSourcesByMemorybookId(memorybookId: string): Promise<SourceDocument[]> {
    return await db
      .select()
      .from(sourceDocuments)
      .where(eq(sourceDocuments.memorybookId, memorybookId));
  }

  /**
   * Search chunks using ParadeDB BM25 pg_search algorithmic indexing.
   * Searches retrieval_content (context-enriched) when present, falling back to content.
   * Returns heading and section_path for structured citations.
   */
  async searchBM25(memorybookId: string, query?: string, limit = 5): Promise<any[]> {
    const cleanQuery = query?.trim();

    if (!cleanQuery) {
      const result = await db.execute(sql`
        SELECT
          id, source_id, memorybook_id, content,
          COALESCE(retrieval_content, content) AS retrieval_content,
          heading, section_path, chunk_index,
          1.0 AS bm25_score
        FROM document_chunks
        WHERE memorybook_id = ${memorybookId}
        ORDER BY chunk_index ASC
        LIMIT ${limit}
      `);
      return result.rows;
    }

    // ParadeDB's `@@@` operator parses its right-hand side with tantivy's
    // query DSL, which gives special meaning to punctuation such as
    // `: + - ! ( ) [ ] { } ^ " ~ * ?` and to em/en-dashes. LLM-rewritten
    // queries (e.g. the query-enhancer's corrected natural-language
    // sentences) often contain this punctuation and trip the parser,
    // raising a Postgres XX000 error that silently falls back to the
    // (lower-relevance) ILIKE search below. Sanitize before the @@@ call so
    // BM25 stays usable for these queries instead of degrading.
    const bm25Query = sanitizeBM25Query(cleanQuery);

    if (!bm25Query) {
      return await this.searchILike(memorybookId, cleanQuery, limit);
    }

    try {
      // Search retrieval_content first (context-enriched); fall back to content for old chunks
      const result = await db.execute(sql`
        SELECT
          id, source_id, memorybook_id, content,
          COALESCE(retrieval_content, content) AS retrieval_content,
          heading, section_path, chunk_index,
          paradedb.score(id) AS bm25_score
        FROM document_chunks
        WHERE memorybook_id = ${memorybookId}
          AND (
            (retrieval_content IS NOT NULL AND retrieval_content @@@ ${bm25Query})
            OR
            (retrieval_content IS NULL AND content @@@ ${bm25Query})
          )
        ORDER BY bm25_score DESC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      logger.error(
        { error, memorybookId, query: cleanQuery },
        'ParadeDB BM25 search failed — falling back to ILIKE substring search'
      );
      return await this.searchILike(memorybookId, cleanQuery, limit);
    }
  }

  /**
   * Plain substring fallback used when BM25 can't run (empty query after
   * sanitization) or fails (ParadeDB parse error).
   */
  private async searchILike(memorybookId: string, query: string, limit: number): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT
        id, source_id, memorybook_id, content,
        COALESCE(retrieval_content, content) AS retrieval_content,
        heading, section_path, chunk_index,
        1.0 AS bm25_score
      FROM document_chunks
      WHERE memorybook_id = ${memorybookId}
        AND (
          retrieval_content ILIKE ${'%' + query + '%'}
          OR content ILIKE ${'%' + query + '%'}
        )
      LIMIT ${limit}
    `);
    return result.rows;
  }

  /**
   * Search multiple expanded queries in parallel and fuse rankings with Reciprocal Rank Fusion (RRF)
   */
  async searchMultiQueryBM25(memorybookId: string, queries: string[], limit = 5): Promise<any[]> {
    const validQueries = queries.map((q) => q.trim()).filter((q) => q.length > 0);
    if (validQueries.length === 0) {
      return await this.searchBM25(memorybookId, undefined, limit);
    }

    if (validQueries.length === 1) {
      return await this.searchBM25(memorybookId, validQueries[0], limit);
    }

    // Execute BM25 search for each expanded query term
    const searchPromises = validQueries.map((q) => this.searchBM25(memorybookId, q, limit * 2));
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
  async searchVector(memorybookId: string, queryEmbedding: number[], limit = 5): Promise<any[]> {
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    try {
      const result = await db.execute(sql`
        SELECT
          id, source_id, memorybook_id, content,
          COALESCE(retrieval_content, content) AS retrieval_content,
          heading, section_path, chunk_index,
          1 - (embedding <=> ${vectorLiteral}::vector) AS vector_score
        FROM document_chunks
        WHERE memorybook_id = ${memorybookId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorLiteral}::vector ASC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      logger.error(
        { error, memorybookId },
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
   * time (see EmbeddingService#embedQuerySafe) or no chunks in this memorybook
   * have been embedded yet, this transparently falls back to BM25-only
   * rather than failing the chat turn.
   */
  async searchHybrid(memorybookId: string, queries: string[], queryEmbedding: number[] | null, limit = 5): Promise<any[]> {
    const [bm25Rows, vectorRows] = await Promise.all([
      this.searchMultiQueryBM25(memorybookId, queries, limit * 2),
      queryEmbedding ? this.searchVector(memorybookId, queryEmbedding, limit * 2) : Promise.resolve([]),
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

