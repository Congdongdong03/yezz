import { users, type Db } from "@yezz/db";
import { eq } from "drizzle-orm";

export type UserRole = "admin" | "staff";

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

    findAllOrdered() {
      return db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);
    },

    async create(data: {
      email: string;
      passwordHash: string;
      name: string;
      role: UserRole;
    }) {
      const [row] = await db
        .insert(users)
        .values({
          email: data.email.trim().toLowerCase(),
          passwordHash: data.passwordHash,
          name: data.name.trim(),
          role: data.role,
          updatedAt: new Date(),
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        });
      return row;
    },

    async update(id: string, data: { email?: string; name?: string; role?: UserRole; passwordHash?: string }) {
      const [row] = await db
        .update(users)
        .set({
          ...data,
          email: data.email?.trim().toLowerCase(),
          name: data.name?.trim(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        });
      return row ?? null;
    },

    async delete(id: string) {
      const [row] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
      return row ?? null;
    },
  };
}
