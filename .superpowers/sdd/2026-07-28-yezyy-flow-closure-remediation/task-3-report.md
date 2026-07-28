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
- Added bounded opportunistic expiry cleanup and a daily maintenance pass with
  shutdown cleanup.
- HMAC-SHA256 hashes normalized subjects with an independent
  `RATE_LIMIT_HASH_SECRET`; weak/missing configuration fails closed.
- Canonicalized verified IPv4/IPv6 identities before hashing.
- Booking and cart-order creation use verified signed client IPs at five/hour.
- Login consumes both `login-ip-email` at five/hour and `login-ip` at
  thirty/hour.
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

## Verification

- `corepack pnpm --filter @yezz/api test`
  - 20 files passed, 2 gated files skipped.
  - 115 tests passed, 17 gated tests skipped.
- `TEST_DATABASE_URL=<local-test-db> corepack pnpm test:rate-limits:db`
  - 1 file passed, 5 PostgreSQL tests passed.
  - Covers exactly five of eight concurrent consumptions, subject isolation,
    fixed-window boundary rollover, opportunistic cleanup, and daily cleanup.
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
