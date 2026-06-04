import { cartSessions, type CartSessionItem, type Db } from "@yezz/db";
import { eq, lt } from "drizzle-orm";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createCartSessionsRepository(db: Db) {
  return {
    async findById(id: string) {
      const [row] = await db
        .select()
        .from(cartSessions)
        .where(eq(cartSessions.id, id))
        .limit(1);
      return row ?? null;
    },

    async upsert(id: string, items: CartSessionItem[]) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      const existing = await this.findById(id);

      if (existing) {
        const [row] = await db
          .update(cartSessions)
          .set({ items, updatedAt: now, expiresAt })
          .where(eq(cartSessions.id, id))
          .returning();
        return row!;
      }

      const [row] = await db
        .insert(cartSessions)
        .values({ id, items, expiresAt, updatedAt: now })
        .returning();
      return row;
    },

    async deleteExpired() {
      const now = new Date();
      return db.delete(cartSessions).where(lt(cartSessions.expiresAt, now));
    },
  };
}
