import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async upsertUser(data: NewUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          imageUrl: data.imageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }
}
