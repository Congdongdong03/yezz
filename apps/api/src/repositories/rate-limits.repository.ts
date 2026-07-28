import { requestRateLimits, type Db } from "@yezz/db";
import { sql } from "drizzle-orm";

export type RateLimitBucketInput = {
  scope: string;
  subjectHash: string;
  limit: number;
  windowSeconds: number;
  now: Date;
};

export type RateLimitBucketResult = {
  consumed: boolean;
  requestCount: number;
  expiresAt: Date;
};

export type RateLimitsRepository = {
  consume(input: RateLimitBucketInput): Promise<RateLimitBucketResult>;
  purgeExpired(now: Date): Promise<number>;
};

type RateLimitRow = {
  consumed: boolean;
  request_count: number;
  expires_at: Date;
};

export function createRateLimitsRepository(db: Db): RateLimitsRepository {
  return {
    async consume(input) {
      const rows = await db.execute<RateLimitRow>(sql`
        WITH bucket_input AS (
          SELECT
            ${input.scope}::varchar(64) AS scope,
            ${input.subjectHash}::varchar(64) AS subject_hash,
            ${input.now.toISOString()}::timestamptz AS observed_at,
            to_timestamp(
              floor(extract(epoch FROM ${input.now.toISOString()}::timestamptz) / ${input.windowSeconds})
              * ${input.windowSeconds}
            ) AS window_started_at
        ),
        expired_cleanup AS (
          DELETE FROM ${requestRateLimits}
          WHERE ctid IN (
            SELECT ctid
            FROM ${requestRateLimits}
            WHERE "expires_at" <= (SELECT observed_at FROM bucket_input)
            ORDER BY "expires_at"
            LIMIT 100
          )
          RETURNING 1
        ),
        prepared_bucket AS (
          SELECT
            scope,
            subject_hash,
            window_started_at,
            window_started_at + make_interval(secs => ${input.windowSeconds}) AS expires_at
          FROM bucket_input
        ),
        consumed_bucket AS (
          INSERT INTO ${requestRateLimits} (
            "scope",
            "subject_hash",
            "window_started_at",
            "request_count",
            "expires_at"
          )
          SELECT scope, subject_hash, window_started_at, 1, expires_at
          FROM prepared_bucket
          ON CONFLICT ("scope", "subject_hash", "window_started_at")
          DO UPDATE
            SET "request_count" = "request_rate_limits"."request_count" + 1
            WHERE "request_rate_limits"."request_count" < ${input.limit}
          RETURNING "request_count", "expires_at"
        )
        SELECT
          true AS consumed,
          "request_count",
          "expires_at"
        FROM consumed_bucket
        UNION ALL
        SELECT
          false AS consumed,
          ${input.limit}::integer AS request_count,
          prepared_bucket.expires_at
        FROM prepared_bucket
        WHERE NOT EXISTS (SELECT 1 FROM consumed_bucket)
        LIMIT 1
      `);
      const row = rows[0];
      if (!row) {
        throw new Error("Rate-limit bucket operation returned no result");
      }

      return {
        consumed: row.consumed,
        requestCount: Number(row.request_count),
        expiresAt:
          row.expires_at instanceof Date
            ? row.expires_at
            : new Date(row.expires_at),
      };
    },

    async purgeExpired(now) {
      const rows = await db.execute<{ deleted_count: number }>(sql`
        WITH deleted_buckets AS (
          DELETE FROM ${requestRateLimits}
          WHERE "expires_at" <= ${now.toISOString()}::timestamptz
          RETURNING 1
        )
        SELECT count(*)::integer AS deleted_count
        FROM deleted_buckets
      `);
      return Number(rows[0]?.deleted_count ?? 0);
    },
  };
}
