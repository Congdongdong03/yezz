import { users, type Db } from "@yezz/db";
import { eq } from "drizzle-orm";

export function createUsersRepository(db: Db) {
  return {
    async findByEmail(email: string) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          name: users.name,
          role: users.role,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },

    async findById(id: string) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },
  };
}
