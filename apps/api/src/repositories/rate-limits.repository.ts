import { requestRateLimits, type Db } from "@yezz/db";
import { sql } from "drizzle-orm";

export type RateLimitBucketInput = {
  scope: string;
  subjectHash: string;
  limit: number;
  windowSeconds: number;
  testReferenceTime?: Date;
};

export type RateLimitBucketResult = {
  consumed: boolean;
  requestCount: number;
  observedAt: Date;
  expiresAt: Date;
};

export type RateLimitPurgeInput = {
  batchSize: number;
  testReferenceTime?: Date;
};

export type RateLimitsRepository = {
  consume(
    input: RateLimitBucketInput,
    connection?: Db,
  ): Promise<RateLimitBucketResult>;
  purgeExpired(input: RateLimitPurgeInput): Promise<number>;
};

type RateLimitRow = {
  consumed: boolean;
  request_count: number;
  observed_at: Date;
  expires_at: Date;
};

function resolveTestReferenceTime(referenceTime: Date | undefined) {
  if (!referenceTime) return null;
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Rate-limit reference time is only available in tests");
  }
  return referenceTime.toISOString();
}

export function createRateLimitsRepository(db: Db): RateLimitsRepository {
  return {
    async consume(input, connection = db) {
      const testReferenceTime = resolveTestReferenceTime(
        input.testReferenceTime,
      );
      const rows = await connection.execute<RateLimitRow>(sql`
        WITH bucket_input AS (
          SELECT
            ${input.scope}::varchar(64) AS scope,
            ${input.subjectHash}::varchar(64) AS subject_hash,
            COALESCE(
              ${testReferenceTime}::timestamptz,
              statement_timestamp()
            ) AS observed_at,
            to_timestamp(
              floor(
                extract(
                  epoch FROM COALESCE(
                    ${testReferenceTime}::timestamptz,
                    statement_timestamp()
                  )
                ) / ${input.windowSeconds}
              )
              * ${input.windowSeconds}
            ) AS window_started_at
        ),
        expired_batch AS (
          SELECT ctid
          FROM ${requestRateLimits}
          WHERE "expires_at" <= (SELECT observed_at FROM bucket_input)
          ORDER BY "expires_at"
          FOR UPDATE SKIP LOCKED
          LIMIT 100
        ),
        expired_cleanup AS (
          DELETE FROM ${requestRateLimits} AS expired
          USING expired_batch
          WHERE expired.ctid = expired_batch.ctid
          RETURNING 1
        ),
        prepared_bucket AS (
          SELECT
            scope,
            subject_hash,
            observed_at,
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
          consumed_bucket."request_count",
          consumed_bucket."expires_at",
          prepared_bucket.observed_at
        FROM consumed_bucket, prepared_bucket
        UNION ALL
        SELECT
          false AS consumed,
          ${input.limit}::integer AS request_count,
          prepared_bucket.expires_at,
          prepared_bucket.observed_at
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
        observedAt:
          row.observed_at instanceof Date
            ? row.observed_at
            : new Date(row.observed_at),
        expiresAt:
          row.expires_at instanceof Date
            ? row.expires_at
            : new Date(row.expires_at),
      };
    },

    async purgeExpired(input) {
      if (!Number.isSafeInteger(input.batchSize) || input.batchSize < 1) {
        throw new Error("Rate-limit purge batch size must be a positive integer");
      }
      const testReferenceTime = resolveTestReferenceTime(
        input.testReferenceTime,
      );
      const rows = await db.execute<{ deleted_count: number }>(sql`
        WITH purge_input AS (
          SELECT COALESCE(
            ${testReferenceTime}::timestamptz,
            statement_timestamp()
          ) AS observed_at
        ),
        expired_batch AS (
          SELECT ctid
          FROM ${requestRateLimits}
          WHERE "expires_at" <= (SELECT observed_at FROM purge_input)
          ORDER BY "expires_at"
          FOR UPDATE SKIP LOCKED
          LIMIT ${input.batchSize}
        ),
        deleted_buckets AS (
          DELETE FROM ${requestRateLimits} AS expired
          USING expired_batch
          WHERE expired.ctid = expired_batch.ctid
          RETURNING 1
        )
        SELECT count(*)::integer AS deleted_count
        FROM deleted_buckets
      `);
      return Number(rows[0]?.deleted_count ?? 0);
    },
  };
}
