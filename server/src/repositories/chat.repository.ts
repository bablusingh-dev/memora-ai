import { eq, and, asc, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatMessages } from '../db/schema.js';

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

export class ChatRepository {
  /** Full history — used by the "get chat history" endpoint the UI renders. */
  async findByNotebookId(notebookId: string, userId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.notebookId, notebookId), eq(chatMessages.userId, userId)))
      .orderBy(asc(chatMessages.createdAt));
  }

  /**
   * Bounded "last N turns" query for the memory coordinator's CONVERSATION
   * layer — SQL-side ORDER BY + LIMIT (backed by
   * idx_chat_messages_notebook_created) instead of fetching a notebook's
   * entire chat history every single turn just to slice the tail in
   * application code. Returned in chronological order (oldest first), same
   * as findByNotebookId, since callers format these as a transcript.
   */
  async findRecentByNotebookId(notebookId: string, userId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.notebookId, notebookId), eq(chatMessages.userId, userId)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async createMessage(data: NewChatMessage): Promise<ChatMessage> {
    const [result] = await db.insert(chatMessages).values(data).returning();
    return result;
  }

  async clearByNotebookId(notebookId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(chatMessages)
      .where(and(eq(chatMessages.notebookId, notebookId), eq(chatMessages.userId, userId)))
      .returning();
    return result.length >= 0;
  }
}
