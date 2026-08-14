import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notes } from '../db/schema.js';

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export class NoteRepository {
  async findByNotebookId(notebookId: string): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.notebookId, notebookId))
      .orderBy(desc(notes.createdAt));
  }

  async createNote(data: NewNote): Promise<Note> {
    const result = await db.insert(notes).values(data).returning();
    return result[0];
  }

  async deleteNote(id: string, notebookId: string): Promise<boolean> {
    const result = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.notebookId, notebookId)))
      .returning();
    return result.length > 0;
  }
}
