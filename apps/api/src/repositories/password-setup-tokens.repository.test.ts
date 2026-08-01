import {
  emailOutbox,
  passwordSetupTokens,
  sealPasswordSetupToken,
  users,
} from "@yezz/db";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createEmailOutboxRepository } from "./email-outbox.repository.js";
import { createPasswordSetupTokensRepository } from "./password-setup-tokens.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";
const passwordSetupTokenSecret =
  "repository-test-password-setup-token-secret-at-least-32-bytes";

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
    await database?.close();
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

  it("allows only one concurrent transaction to consume a setup digest", async () => {
    const repo = createPasswordSetupTokensRepository(database.connection.db);
    const digest = "c".repeat(64);
    await database.connection.db.insert(passwordSetupTokens).values({
      userId,
      tokenDigest: digest,
      expiresAt: new Date("2030-08-01T01:00:00.000Z"),
    });
    const now = new Date("2030-08-01T00:00:00.000Z");
    const consume = () =>
      database.connection.db.transaction(async (tx) => {
        const token = await repo.findActiveByDigestForUpdate(
          digest,
          now,
          tx as never,
        );
        if (!token) return false;
        return Boolean(await repo.markUsed(token.id, now, tx as never));
      });

    const results = await Promise.all([consume(), consume()]);

    expect(results.sort()).toEqual([false, true]);
  });

  it("serializes concurrent issuance so only the newest setup token stays active", async () => {
    const repo = createPasswordSetupTokensRepository(database.connection.db);
    const issue = (digest: string, now: Date) =>
      database.connection.db.transaction(async (tx) => {
        await repo.lockForIssue(userId, tx as never);
        await repo.revokeActiveForUser(userId, now, tx as never);
        return repo.create(
          {
            userId,
            tokenDigest: digest,
            expiresAt: new Date("2030-08-01T01:00:00.000Z"),
          },
          tx as never,
        );
      });

    await Promise.all([
      issue("e".repeat(64), new Date("2030-08-01T00:00:00.000Z")),
      issue("f".repeat(64), new Date("2030-08-01T00:00:01.000Z")),
    ]);

    const rows = await database.connection.db
      .select()
      .from(passwordSetupTokens);
    expect(rows).toHaveLength(2);
    expect(rows.filter(({ revokedAt }) => revokedAt === null)).toHaveLength(1);
  });

  it("persists a parentless setup email with the digest and rolls both back on an invalid outbox payload", async () => {
    const tokens = createPasswordSetupTokensRepository(database.connection.db);
    const outbox = createEmailOutboxRepository(database.connection.db);
    const rawToken = "R".repeat(43);
    const tokenDigest = createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date("2030-08-01T01:00:00.000Z");

    await database.connection.db.transaction(async (tx) => {
      const token = await tokens.create(
        { userId, tokenDigest, expiresAt },
        tx as never,
      );
      await outbox.enqueue(
        {
          dedupeKey: `admin-password-setup:${token.id}`,
          bookingId: null,
          cartOrderId: null,
          statusEventId: null,
          messageType: "admin_password_setup",
          recipient: "owner@example.test",
          locale: "en",
          payload: {
            template: "admin_password_setup",
            name: "Owner",
            email: "owner@example.test",
            role: "owner",
            sealedSetupToken: sealPasswordSetupToken(
              rawToken,
              passwordSetupTokenSecret,
            ),
            expiresAt: expiresAt.toISOString(),
          },
        },
        tx as never,
      );
    });

    const [storedToken] = await database.connection.db
      .select()
      .from(passwordSetupTokens);
    const [storedEmail] = await database.connection.db
      .select()
      .from(emailOutbox);
    expect(storedToken).toMatchObject({ tokenDigest });
    expect(JSON.stringify(storedToken)).not.toContain(rawToken);
    expect(storedEmail).toMatchObject({
      bookingId: null,
      cartOrderId: null,
      statusEventId: null,
      messageType: "admin_password_setup",
    });
    expect(JSON.stringify(storedEmail)).not.toContain(rawToken);

    await expect(
      database.connection.db.transaction(async (tx) => {
        await tokens.create(
          {
            userId,
            tokenDigest: "d".repeat(64),
            expiresAt,
          },
          tx as never,
        );
        await outbox.enqueue(
          {
            dedupeKey: "admin-password-setup:invalid",
            bookingId: null,
            cartOrderId: null,
            statusEventId: null,
            messageType: "admin_password_setup",
            recipient: "owner@example.test",
            locale: "en",
            payload: {
              template: "admin_password_setup",
              name: "Owner",
              email: "owner@example.test",
              role: "owner",
              sealedSetupToken: "not-a-sealed-token",
              expiresAt: expiresAt.toISOString(),
            },
          },
          tx as never,
        );
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });
    const tokenRows = await database.connection.db
      .select()
      .from(passwordSetupTokens);
    expect(tokenRows).toHaveLength(1);
  });
});
