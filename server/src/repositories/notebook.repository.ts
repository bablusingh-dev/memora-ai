import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notebooks, sourceDocuments, documentChunks, notes } from '../db/schema.js';
import { IBaseRepository } from './base.repository.js';

export type Notebook = typeof notebooks.$inferSelect;
export type NewNotebook = typeof notebooks.$inferInsert;
export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;

export class NotebookRepository implements IBaseRepository<Notebook> {
  async findById(id: string): Promise<Notebook | null> {
    const result = await db.select().from(notebooks).where(eq(notebooks.id, id)).limit(1);
    return result[0] || null;
  }

  async findAll(): Promise<Notebook[]> {
    return await db.select().from(notebooks).orderBy(notebooks.createdAt);
  }

  async create(data: NewNotebook): Promise<Notebook> {
    const result = await db.insert(notebooks).values(data).returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(notebooks).where(eq(notebooks.id, id)).returning();
    return result.length > 0;
  }

  async getSourcesByNotebookId(notebookId: string): Promise<SourceDocument[]> {
    return await db
      .select()
      .from(sourceDocuments)
      .where(eq(sourceDocuments.notebookId, notebookId));
  }

  /**
   * Search chunks using ParadeDB BM25 pg_search algorithmic indexing
   * Safely isolates raw SQL fragments for BM25 ranking
   */
  async searchBM25(notebookId: string, query: string, limit = 5): Promise<any[]> {
    try {
      // ParadeDB pg_search BM25 query execution
      const result = await db.execute(sql`
        SELECT 
          id, 
          source_id, 
          notebook_id, 
          content, 
          chunk_index,
          score() AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId} AND content @@@ ${query}
        ORDER BY bm25_score DESC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      // Fallback query if ParadeDB BM25 index is initializing or in dev fallback
      const fallbackResult = await db.execute(sql`
        SELECT 
          id, 
          source_id, 
          notebook_id, 
          content, 
          chunk_index,
          1.0 AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId} AND content ILIKE ${'%' + query + '%'}
        LIMIT ${limit}
      `);
      return fallbackResult.rows;
    }
  }
}
