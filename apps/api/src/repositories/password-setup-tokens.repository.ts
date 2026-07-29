import { passwordSetupTokens, type Db } from "@yezz/db";
import { and, eq, gt, isNull, ne } from "drizzle-orm";

export type PasswordSetupTokenInsert = {
  userId: string;
  tokenDigest: string;
  expiresAt: Date;
};

export function createPasswordSetupTokensRepository(db: Db) {
  return {
    async create(input: PasswordSetupTokenInsert, tx: Db = db) {
      const [row] = await tx
        .insert(passwordSetupTokens)
        .values(input)
        .returning();
      if (!row) throw new Error("Password setup token insert returned no row");
      return row;
    },

    async findActiveByDigestForUpdate(
      tokenDigest: string,
      now: Date,
      tx: Db = db,
    ) {
      const [row] = await tx
        .select()
        .from(passwordSetupTokens)
        .where(
          and(
            eq(passwordSetupTokens.tokenDigest, tokenDigest),
            isNull(passwordSetupTokens.usedAt),
            isNull(passwordSetupTokens.revokedAt),
            gt(passwordSetupTokens.expiresAt, now),
          ),
        )
        .limit(1)
        .for("update");
      return row ?? null;
    },

    async markUsed(id: string, now: Date, tx: Db = db) {
      const [row] = await tx
        .update(passwordSetupTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordSetupTokens.id, id),
            isNull(passwordSetupTokens.usedAt),
            isNull(passwordSetupTokens.revokedAt),
            gt(passwordSetupTokens.expiresAt, now),
          ),
        )
        .returning();
      return row ?? null;
    },

    async revokeActiveForUser(
      userId: string,
      now: Date,
      tx: Db = db,
      exceptId?: string,
    ) {
      await tx
        .update(passwordSetupTokens)
        .set({ revokedAt: now })
        .where(
          and(
            eq(passwordSetupTokens.userId, userId),
            isNull(passwordSetupTokens.usedAt),
            isNull(passwordSetupTokens.revokedAt),
            ...(exceptId ? [ne(passwordSetupTokens.id, exceptId)] : []),
          ),
        );
    },

    // Raw setup tokens are deliberately never a repository lookup key.
    async findByRawToken(_rawToken: string): Promise<null> {
      return null;
    },
  };
}

export type PasswordSetupTokensRepository = ReturnType<
  typeof createPasswordSetupTokensRepository
>;
