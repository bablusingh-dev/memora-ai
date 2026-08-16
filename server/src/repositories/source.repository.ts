import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sourceDocuments, documentChunks } from '../db/schema.js';

export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type NewSourceDocument = typeof sourceDocuments.$inferInsert;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

export class SourceRepository {
  async findById(id: string): Promise<SourceDocument | null> {
    const result = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, id)).limit(1);
    return result[0] || null;
  }

  async findByNotebookId(notebookId: string): Promise<SourceDocument[]> {
    return await db
      .select()
      .from(sourceDocuments)
      .where(eq(sourceDocuments.notebookId, notebookId))
      .orderBy(sourceDocuments.createdAt);
  }

  async createSource(data: NewSourceDocument): Promise<SourceDocument> {
    const result = await db.insert(sourceDocuments).values(data).returning();
    return result[0];
  }

  async updateSourceStatus(id: string, status: 'ready' | 'error' | 'processing'): Promise<void> {
    await db
      .update(sourceDocuments)
      .set({ status })
      .where(eq(sourceDocuments.id, id));
  }

  async insertChunks(chunks: NewDocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    await db.insert(documentChunks).values(chunks);
  }

  async deleteSource(id: string, notebookId: string): Promise<boolean> {
    const result = await db
      .delete(sourceDocuments)
      .where(and(eq(sourceDocuments.id, id), eq(sourceDocuments.notebookId, notebookId)))
      .returning();
    return result.length > 0;
  }
}
