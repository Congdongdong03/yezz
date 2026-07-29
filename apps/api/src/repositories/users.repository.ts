import { users, type Db } from "@yezz/db";
import { eq } from "drizzle-orm";
import {
  legacyUserRoleFromDatabaseRole,
  type LegacyUserRole,
} from "../lib/legacy-user-role.js";

export type UserRole = LegacyUserRole;

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
      return row ? { ...row, role: legacyUserRoleFromDatabaseRole(row.role) } : null;
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
      return row ? { ...row, role: legacyUserRoleFromDatabaseRole(row.role) } : null;
    },

    async findByIdWithPasswordHash(id: string) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          name: users.name,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ? { ...row, role: legacyUserRoleFromDatabaseRole(row.role) } : null;
    },

    async findAllOrdered() {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);
      return rows.map((row) => ({
        ...row,
        role: legacyUserRoleFromDatabaseRole(row.role),
      }));
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
      return { ...row, role: legacyUserRoleFromDatabaseRole(row.role) };
    },

    async update(id: string, data: { email?: string; name?: string; role?: UserRole; passwordHash?: string }) {
      const [row] = await db
        .update(users)
        .set({
          ...data,
          email: data.email ? data.email.trim().toLowerCase() : undefined,
          name: data.name ? data.name.trim() : undefined,
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
      return row ? { ...row, role: legacyUserRoleFromDatabaseRole(row.role) } : null;
    },

    async delete(id: string) {
      const [row] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
      return row ?? null;
    },
  };
}
