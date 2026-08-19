import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { studioArtifacts } from '../db/schema.js';

export type StudioArtifact = typeof studioArtifacts.$inferSelect;
export type NewStudioArtifact = typeof studioArtifacts.$inferInsert;

export class StudioRepository {
  async findByMemorybookId(memorybookId: string): Promise<StudioArtifact[]> {
    return await db
      .select()
      .from(studioArtifacts)
      .where(eq(studioArtifacts.memorybookId, memorybookId))
      .orderBy(desc(studioArtifacts.createdAt));
  }

  async findById(id: string, memorybookId: string): Promise<StudioArtifact | null> {
    const result = await db
      .select()
      .from(studioArtifacts)
      .where(and(eq(studioArtifacts.id, id), eq(studioArtifacts.memorybookId, memorybookId)))
      .limit(1);
    return result[0] || null;
  }

  async createArtifact(data: NewStudioArtifact): Promise<StudioArtifact> {
    const result = await db.insert(studioArtifacts).values(data).returning();
    return result[0];
  }

  async updateArtifact(id: string, data: Partial<NewStudioArtifact>): Promise<StudioArtifact | null> {
    const result = await db
      .update(studioArtifacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studioArtifacts.id, id))
      .returning();
    return result[0] || null;
  }

  async deleteArtifact(id: string, memorybookId: string): Promise<boolean> {
    const result = await db
      .delete(studioArtifacts)
      .where(and(eq(studioArtifacts.id, id), eq(studioArtifacts.memorybookId, memorybookId)))
      .returning();
    return result.length > 0;
  }
}
