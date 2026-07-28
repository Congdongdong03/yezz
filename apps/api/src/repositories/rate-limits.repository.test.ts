import { createDb } from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRateLimitsRepository } from "./rate-limits.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_RATE_LIMIT_DB_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function requireSafeTestDatabaseUrl(): string {
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_RATE_LIMIT_DB_TESTS=1",
    );
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Rate-limit tests refuse TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }

  const parsedUrl = new URL(testDatabaseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname)) {
    throw new Error("Rate-limit tests require a local PostgreSQL host");
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Rate-limit tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return testDatabaseUrl;
}

function withSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}

let adminConnection: ReturnType<typeof createDb> | undefined;
let testConnection: ReturnType<typeof createDb> | undefined;
let schemaName: string | undefined;

beforeEach(async () => {
  if (!runDatabaseTests) return;

  const safeUrl = requireSafeTestDatabaseUrl();
  schemaName = `yezyy_rate_limit_test_${crypto.randomUUID().replaceAll("-", "")}`;
  adminConnection = createDb(safeUrl);
  await adminConnection.client.unsafe(`CREATE SCHEMA "${schemaName}"`);
  await adminConnection.client.unsafe(`
    CREATE TABLE "${schemaName}"."request_rate_limits" (
      "scope" varchar(64) NOT NULL,
      "subject_hash" varchar(64) NOT NULL,
      "window_started_at" timestamp with time zone NOT NULL,
      "request_count" integer DEFAULT 1 NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      CONSTRAINT "request_rate_limits_pk"
        PRIMARY KEY ("scope", "subject_hash", "window_started_at"),
      CONSTRAINT "request_rate_limits_count_positive"
        CHECK ("request_count" >= 1)
    )
  `);
  testConnection = createDb(withSearchPath(safeUrl, schemaName));
});

afterEach(async () => {
  if (testConnection) {
    await testConnection.client.end();
    testConnection = undefined;
  }
  if (adminConnection) {
    if (schemaName) {
      await adminConnection.client.unsafe(
        `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
      );
    }
    await adminConnection.client.end();
    adminConnection = undefined;
  }
  schemaName = undefined;
});

describe.skipIf(!runDatabaseTests)(
  "PostgreSQL rate-limit repository (set YEZYY_RUN_RATE_LIMIT_DB_TESTS=1 with a safe local TEST_DATABASE_URL)",
  () => {
    it("allows exactly five of eight concurrent bucket consumptions", async () => {
      const repository = createRateLimitsRepository(testConnection!.db);
      const input = {
        scope: "booking",
        subjectHash: "a".repeat(64),
        limit: 5,
        windowSeconds: 3600,
        now: new Date("2026-07-28T09:05:00.000Z"),
      };

      const results = await Promise.all(
        Array.from({ length: 8 }, () => repository.consume(input)),
      );

      expect(results.filter(({ consumed }) => consumed)).toHaveLength(5);
      expect(results.filter(({ consumed }) => !consumed)).toHaveLength(3);
      expect(results.every(({ requestCount }) => requestCount <= 5)).toBe(true);
    });

    it("isolates subject hashes within the same scope", async () => {
      const repository = createRateLimitsRepository(testConnection!.db);
      const baseInput = {
        scope: "booking",
        limit: 1,
        windowSeconds: 3600,
        now: new Date("2026-07-28T09:05:00.000Z"),
      };

      await expect(
        repository.consume({ ...baseInput, subjectHash: "a".repeat(64) }),
      ).resolves.toMatchObject({ consumed: true, requestCount: 1 });
      await expect(
        repository.consume({ ...baseInput, subjectHash: "b".repeat(64) }),
      ).resolves.toMatchObject({ consumed: true, requestCount: 1 });
    });

    it("starts a fresh bucket exactly at the fixed-window boundary", async () => {
      const repository = createRateLimitsRepository(testConnection!.db);
      const baseInput = {
        scope: "booking",
        subjectHash: "a".repeat(64),
        limit: 1,
        windowSeconds: 3600,
      };

      await expect(
        repository.consume({
          ...baseInput,
          now: new Date("2026-07-28T09:59:59.999Z"),
        }),
      ).resolves.toEqual({
        consumed: true,
        requestCount: 1,
        expiresAt: new Date("2026-07-28T10:00:00.000Z"),
      });
      await expect(
        repository.consume({
          ...baseInput,
          now: new Date("2026-07-28T09:59:59.999Z"),
        }),
      ).resolves.toMatchObject({ consumed: false, requestCount: 1 });
      await expect(
        repository.consume({
          ...baseInput,
          now: new Date("2026-07-28T10:00:00.000Z"),
        }),
      ).resolves.toEqual({
        consumed: true,
        requestCount: 1,
        expiresAt: new Date("2026-07-28T11:00:00.000Z"),
      });
    });

    it("opportunistically removes an expired bucket while consuming", async () => {
      await testConnection!.client`
        INSERT INTO request_rate_limits (
          scope,
          subject_hash,
          window_started_at,
          request_count,
          expires_at
        )
        VALUES (
          'booking',
          ${"e".repeat(64)},
          '2026-07-28T08:00:00.000Z',
          1,
          '2026-07-28T09:00:00.000Z'
        )
      `;
      const repository = createRateLimitsRepository(testConnection!.db);

      await repository.consume({
        scope: "booking",
        subjectHash: "a".repeat(64),
        limit: 5,
        windowSeconds: 3600,
        now: new Date("2026-07-28T10:00:00.000Z"),
      });

      const expired = await testConnection!.client`
        SELECT subject_hash
        FROM request_rate_limits
        WHERE subject_hash = ${"e".repeat(64)}
      `;
      expect(expired).toHaveLength(0);
    });

    it("deletes all expired buckets in the daily maintenance pass", async () => {
      await testConnection!.client`
        INSERT INTO request_rate_limits (
          scope,
          subject_hash,
          window_started_at,
          request_count,
          expires_at
        )
        VALUES
          (
            'booking',
            ${"e".repeat(64)},
            '2026-07-28T08:00:00.000Z',
            1,
            '2026-07-28T09:00:00.000Z'
          ),
          (
            'booking',
            ${"f".repeat(64)},
            '2026-07-28T10:00:00.000Z',
            1,
            '2026-07-28T11:00:00.000Z'
          )
      `;
      const repository = createRateLimitsRepository(testConnection!.db);

      await expect(
        repository.purgeExpired(new Date("2026-07-28T10:00:00.000Z")),
      ).resolves.toBe(1);

      const remaining = await testConnection!.client<
        { subject_hash: string }[]
      >`
        SELECT subject_hash
        FROM request_rate_limits
        ORDER BY subject_hash
      `;
      expect(remaining.map(({ subject_hash }) => subject_hash)).toEqual([
        "f".repeat(64),
      ]);
    });
  },
);
