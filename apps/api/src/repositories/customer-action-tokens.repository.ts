import {
  customerActionTokens,
  type CustomerActionScope,
  type Db,
} from "@yezz/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

export type CustomerActionTokenInsert = {
  bookingId: string;
  tokenDigest: string;
  scopes: CustomerActionScope[];
  expiresAt: Date;
};

export function createCustomerActionTokensRepository(db: Db) {
  return {
    async create(input: CustomerActionTokenInsert, tx: Db = db) {
      const [row] = await tx.insert(customerActionTokens).values(input).returning();
      if (!row) throw new Error("Customer action token insert did not return a row");
      return row;
    },

    async findActiveByDigest(tokenDigest: string, now: Date, tx: Db = db) {
      const [row] = await tx
        .select()
        .from(customerActionTokens)
        .where(
          and(
            eq(customerActionTokens.tokenDigest, tokenDigest),
            isNull(customerActionTokens.revokedAt),
            gt(customerActionTokens.expiresAt, now),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async consume(id: string, now: Date, tx: Db = db) {
      const [row] = await tx
        .update(customerActionTokens)
        .set({ revokedAt: now })
        .where(and(eq(customerActionTokens.id, id), isNull(customerActionTokens.revokedAt)))
        .returning();
      return row ?? null;
    },

    async revokeActiveAcceptTimeTokens(bookingId: string, now: Date, tx: Db = db) {
      await tx.update(customerActionTokens).set({ revokedAt: now })
        .where(and(eq(customerActionTokens.bookingId, bookingId), isNull(customerActionTokens.revokedAt), sql`${customerActionTokens.scopes} @> ARRAY['accept_time']::text[]`));
    },

    // Raw plaintext tokens are intentionally not a storage or lookup key.
    async findByRawToken(_rawToken: string): Promise<null> {
      return null;
    },
  };
}

export type CustomerActionTokensRepository = ReturnType<
  typeof createCustomerActionTokensRepository
>;
