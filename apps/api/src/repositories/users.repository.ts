import { users, type Db, type UserRole } from "@yezz/db";
import { count, eq, sql } from "drizzle-orm";

export type { UserRole };

export function createUsersRepository(db: Db) {
  return {
    async withOwnerMutationLock<T>(
      operation: (tx: Db) => Promise<T>,
    ): Promise<T> {
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Db;
        await tx.execute(sql`select pg_advisory_xact_lock(149978, 1111)`);
        return operation(tx);
      });
    },

    async findByEmail(email: string, tx: Db = db) {
      const [row] = await tx
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          name: users.name,
          role: users.role,
          sessionVersion: users.sessionVersion,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },

    async findById(id: string, tx: Db = db) {
      const [row] = await tx
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          sessionVersion: users.sessionVersion,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },

    async findByIdWithPasswordHash(id: string, tx: Db = db) {
      const [row] = await tx
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          name: users.name,
          role: users.role,
          sessionVersion: users.sessionVersion,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },

    async findAllOrdered() {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          sessionVersion: users.sessionVersion,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);
      return rows;
    },

    async create(data: {
      email: string;
      passwordHash: string;
      name: string;
      role: UserRole;
    }, tx: Db = db) {
      const [row] = await tx
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
          sessionVersion: users.sessionVersion,
          createdAt: users.createdAt,
        });
      if (!row) throw new Error("User insert returned no row");
      return row;
    },

    async update(
      id: string,
      data: {
        email?: string;
        name?: string;
        role?: UserRole;
        passwordHash?: string;
      },
      tx: Db = db,
    ) {
      const [row] = await tx
        .update(users)
        .set({
          ...data,
          email: data.email ? data.email.trim().toLowerCase() : undefined,
          name: data.name ? data.name.trim() : undefined,
          sessionVersion:
            data.role === undefined
              ? undefined
              : sql`${users.sessionVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          sessionVersion: users.sessionVersion,
          createdAt: users.createdAt,
        });
      return row ?? null;
    },

    async updatePasswordAndIncrementSessionVersion(
      id: string,
      passwordHash: string,
      tx: Db = db,
    ) {
      const [row] = await tx
        .update(users)
        .set({
          passwordHash,
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id, sessionVersion: users.sessionVersion });
      return row ?? null;
    },

    async countByRole(role: UserRole, tx: Db = db) {
      const [row] = await tx
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, role));
      return row?.value ?? 0;
    },

    async delete(id: string, tx: Db = db) {
      const [row] = await tx
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id });
      return row ?? null;
    },
  };
}
