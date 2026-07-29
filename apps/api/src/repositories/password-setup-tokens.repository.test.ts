import { passwordSetupTokens, users } from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createPasswordSetupTokensRepository } from "./password-setup-tokens.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("password setup token repository", () => {
  let database: RequestFlowTestDatabase;
  let userId: string;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    const [user] = await database.connection.db
      .insert(users)
      .values({
        email: "owner@example.test",
        passwordHash: "bootstrap-hash",
        name: "Owner",
        role: "owner",
      })
      .returning({ id: users.id });
    userId = user!.id;
  });

  afterEach(async () => {
    await database.close();
  });

  it("finds only an unused, unrevoked, unexpired digest and never raw tokens", async () => {
    const repo = createPasswordSetupTokensRepository(database.connection.db);
    await database.connection.db.insert(passwordSetupTokens).values({
      userId,
      tokenDigest: "a".repeat(64),
      expiresAt: new Date("2030-08-01T01:00:00.000Z"),
    });

    await expect(
      database.connection.db.transaction((tx) =>
        repo.findActiveByDigestForUpdate(
          "a".repeat(64),
          new Date("2030-08-01T00:00:00.000Z"),
          tx as never,
        ),
      ),
    ).resolves.toMatchObject({ userId, tokenDigest: "a".repeat(64) });
    await expect(repo.findByRawToken("A".repeat(43))).resolves.toBeNull();
  });

  it("marks one token used and revokes its active siblings", async () => {
    const repo = createPasswordSetupTokensRepository(database.connection.db);
    const [used, sibling] = await database.connection.db
      .insert(passwordSetupTokens)
      .values([
        {
          userId,
          tokenDigest: "a".repeat(64),
          expiresAt: new Date("2030-08-01T01:00:00.000Z"),
        },
        {
          userId,
          tokenDigest: "b".repeat(64),
          expiresAt: new Date("2030-08-01T01:00:00.000Z"),
        },
      ])
      .returning();
    const now = new Date("2030-08-01T00:00:00.000Z");

    await database.connection.db.transaction(async (tx) => {
      await repo.markUsed(used!.id, now, tx as never);
      await repo.revokeActiveForUser(
        userId,
        now,
        tx as never,
        used!.id,
      );
    });

    const rows = await database.connection.db
      .select()
      .from(passwordSetupTokens);
    expect(rows.find(({ id }) => id === used!.id)).toMatchObject({
      usedAt: now,
      revokedAt: null,
    });
    expect(rows.find(({ id }) => id === sibling!.id)).toMatchObject({
      usedAt: null,
      revokedAt: now,
    });
  });
});
