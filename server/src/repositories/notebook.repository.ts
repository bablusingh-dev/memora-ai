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
   * Search chunks using ParadeDB BM25 pg_search algorithmic indexing
   * Scoped by notebookId
   */
  async searchBM25(notebookId: string, query?: string, limit = 5): Promise<any[]> {
    const cleanQuery = query?.trim();

    if (!cleanQuery) {
      const result = await db.execute(sql`
        SELECT 
          id, 
          source_id, 
          notebook_id, 
          content, 
          chunk_index,
          1.0 AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId}
        ORDER BY chunk_index ASC
        LIMIT ${limit}
      `);
      return result.rows;
    }

    try {
      const result = await db.execute(sql`
        SELECT 
          id, 
          source_id, 
          notebook_id, 
          content, 
          chunk_index,
          score() AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId} AND content @@@ ${cleanQuery}
        ORDER BY bm25_score DESC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      const fallbackResult = await db.execute(sql`
        SELECT 
          id, 
          source_id, 
          notebook_id, 
          content, 
          chunk_index,
          1.0 AS bm25_score
        FROM document_chunks
        WHERE notebook_id = ${notebookId} AND content ILIKE ${'%' + cleanQuery + '%'}
        LIMIT ${limit}
      `);
      return fallbackResult.rows;
    }
  }
}
