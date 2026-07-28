# Task 3 Report — Durable PostgreSQL Rate Limits

## Scope and base

- Branch: `codex/yezyy-flow-task3-rate-limits`
- Integration base: `5135a97a190ae3c34c6e9c4b9d1271d8fa7f94ac`
- No production or external service was read or changed.
- PostgreSQL integration tests used a disposable local PostgreSQL 16 container
  and a database named `yezyy_rate_limit_test`.

## Delivered

- Added one-statement PostgreSQL fixed-window consumption using
  `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE request_count < limit`.
- Production bucket identity, cleanup eligibility, and reset calculations use
  PostgreSQL `statement_timestamp()` rather than an API-node wall clock.
- Added bounded, lock-skipping opportunistic and daily expiry cleanup.
  Maintenance is single-flight and API shutdown awaits any in-flight batch.
- HMAC-SHA256 hashes normalized subjects with an independent
  `RATE_LIMIT_HASH_SECRET`; weak/missing configuration fails closed.
- Canonicalized verified IPv4/IPv6 identities before hashing.
- Booking and cart-order creation use verified signed client IPs at five/hour.
- Login consumes both `login-ip-email` at five/hour and `login-ip` at
  thirty/hour. Successful responses emit the quota with the smallest remaining
  fraction; equal fractions use the later reset as the deterministic
  tie-breaker.
- Admin read/write/upload limits use the authenticated user ID; production
  upload routing is verified under the full `/api/v1/admin/upload` prefix.
- Removed Redis/process-local request limiting.
- Repository/config/identity failures return generic
  `503 RATE_LIMIT_UNAVAILABLE` without logging raw PII or secrets.
- Added standards-correct `RateLimit-Limit`, `RateLimit-Remaining`,
  `RateLimit-Reset` delay, and `Retry-After` metadata.
- Unsigned fallback is available only when explicitly enabled, outside
  production, in signed-request log mode, and from loopback.
- Documented required production secret provisioning and added a dedicated
  `test:rate-limits:db` command.

## TDD evidence

Red tests were observed before implementation for:

- missing repository/service modules;
- HMAC normalization, weak configuration, and generic 503 behavior;
- public/login/admin identity and route scopes;
- dual login buckets and response metadata;
- fixed-window PostgreSQL concurrency/isolation/boundaries;
- PostgreSQL timestamp driver encoding;
- RFC-style reset delay;
- IPv6 canonicalization;
- full-prefix admin upload classification;
- opportunistic/daily expiry cleanup and maintenance scheduling.
- API-node clock skew cannot split a production bucket;
- bounded maintenance batches, non-overlap, error isolation, and shutdown
  draining;
- maintenance remains schedulable when its error reporter itself fails;
- controlling login metadata for tighter IP, tighter email, and equal-fraction
  reset ties, plus the longer retry delay when both buckets deny.

## Verification

- `corepack pnpm --filter @yezz/api test`
  - 20 files passed, 2 gated files skipped.
  - 120 tests passed, 18 gated tests skipped.
- `TEST_DATABASE_URL=<local-test-db> corepack pnpm test:rate-limits:db`
  - 1 file passed, 6 PostgreSQL tests passed.
  - Covers exactly five of eight concurrent consumptions, subject isolation,
    fixed-window boundary rollover, concurrent skewed API clocks,
    opportunistic cleanup, and bounded maintenance cleanup.
- `corepack pnpm verify`
  - Workspace typecheck passed.
  - API tests passed.
  - Web lint passed.
  - API build passed.
  - Next.js production build passed.

Known build output is limited to pre-existing Next.js workspace-root,
middleware-deprecation, and mock-data configuration warnings; there were no
verification errors.

## Review disposition

Independent read-only review found no critical issue. Its initial important
findings were resolved:

1. full-prefix admin upload requests now receive the 50/hour upload scope;
2. expired buckets now have opportunistic and daily cleanup;
3. the gated PostgreSQL suite now has an explicit root/package command while
   retaining local-only safety checks.

The second-round independent review found no critical or important issue. Its
two low-severity observations were also resolved: maintenance now clears its
single-flight latch even if error reporting throws, and dual-denial selection
has a direct longest-retry regression test.

## Integration note

Task 6 also changes `apps/api/src/plugins/services.ts`. When resolving that
future merge, retain both lifecycle paths: Task 6's `emailOutbox` service and
shutdown behavior, and Task 3's `rateLimits` service plus awaited
`stopRateLimitMaintenance()` shutdown hook.
