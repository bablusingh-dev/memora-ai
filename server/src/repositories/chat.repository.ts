import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatMessages } from '../db/schema.js';

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

export class ChatRepository {
  async findByNotebookId(notebookId: string, userId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.notebookId, notebookId), eq(chatMessages.userId, userId)))
      .orderBy(asc(chatMessages.createdAt));
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
