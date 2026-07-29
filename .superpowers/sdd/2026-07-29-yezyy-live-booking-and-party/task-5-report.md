# Task 5 — Waitlist and Scoped Customer Actions

## Delivered

- Added digest-only customer action token persistence. Tokens are generated from 32 random bytes, returned once as base64url, and stored/queried only as a SHA-256 digest.
- Added scoped resolution with generic `LINK_INVALID_OR_EXPIRED` handling for malformed, unknown, revoked, expired, and cancelled-booking links. `accept_time` resolution is prepared but has no public route or transition.
- Added the narrow `CustomerBookingView`, deliberately excluding booking IDs, contact data, token data, audit identities, and payment-provider data.
- Added customer cancellation and reschedule request transitions. Both create a `customer` status event and owner outbox email in one transaction. Reschedule data is recorded as the structured `customerActionRequest` JSON event note; it does not modify or reserve the current interval.
- Added public customer-booking read/cancellation/reschedule routes with a separate `customer_booking_action` rate-limit scope keyed by verified client IP plus SHA-256 token digest prefix.
- Added waitlist confirmation contact guard. A `waitlisted -> confirmed` administration transition now requires `contactedCustomer: true`; the existing Task 4 transactional capacity check remains the conversion authority.
- Updated status history reads to retain customer-authored events that have no staff user ID.

## TDD evidence

1. Wrote new repository, customer-service, customer-route, and waitlist-contact tests before Task 5 production modules existed.
2. RED command:

   ```bash
   corepack pnpm --filter @yezz/api test -- src/repositories/customer-action-tokens.repository.test.ts src/services/customer-actions.service.test.ts src/routes/v1/customer-bookings.routes.test.ts
   ```

   The new suites failed because `customer-action-tokens.repository`, `customer-actions.service`, and `customer-bookings.routes` did not exist. This was the expected missing-feature failure.
3. GREEN checks after implementation:

   ```bash
   corepack pnpm --filter @yezz/api exec vitest run src/routes/v1/customer-bookings.routes.test.ts --config vitest.config.ts
   # 3 passed

   corepack pnpm --filter @yezz/api typecheck
   # passed
   ```

4. Database-backed repository/service/admin tests are present and guarded by `YEZYY_RUN_DB_BOOKING_TESTS=1`. This sandbox has neither `TEST_DATABASE_URL` nor `DATABASE_URL`, so they were skipped rather than pointed at any production data:

   ```bash
   corepack pnpm --filter @yezz/api exec vitest run src/repositories/customer-action-tokens.repository.test.ts src/services/customer-actions.service.test.ts src/services/admin/bookings.admin.service.test.ts --config vitest.config.ts
   # 10 skipped; TEST_DATABASE_URL_MISSING
   ```

## Full suite result

Ran once:

```bash
corepack pnpm --filter @yezz/api test
```

Result: 34 files passed, 12 database suites skipped, and only the pre-existing SMTP loopback suite failed because this sandbox rejects loopback listeners with:

```text
Error: listen EPERM: operation not permitted 127.0.0.1
```

The affected tests are `src/lib/smtp-outbox.test.ts` (two listener-based tests). Re-run the full API suite with an isolated `TEST_DATABASE_URL` and a sandbox that allows the SMTP loopback listener.

## Files

- `apps/api/src/repositories/customer-action-tokens.repository.ts`
- `apps/api/src/services/customer-actions.service.ts`
- `apps/api/src/routes/v1/customer-bookings.routes.ts`
- Focused tests for each new unit plus the waitlist guard in the existing admin service test.

## Follow-up test-harness fix

- Controller-local isolated PostgreSQL exposed a harness error in the expired-link test: it tried to issue a token expiring on `2030-07-31` while the injected service clock was already `2030-08-01`. Production correctly rejects expired issuance.
- Replaced the fixed injected clock with a test-local mutable clock. The test issues while the clock is `2030-07-30`, then advances it to `2030-08-01` before resolving the token. No production validation was weakened and no global fake timers were introduced.
- Follow-up local verification:

  ```bash
  corepack pnpm --filter @yezz/api exec vitest run src/services/customer-actions.service.test.ts src/repositories/customer-action-tokens.repository.test.ts src/routes/v1/customer-bookings.routes.test.ts --config vitest.config.ts
  # 3 route tests passed; 5 database tests skipped because TEST_DATABASE_URL is unavailable here

  corepack pnpm --filter @yezz/api typecheck
  # passed
  ```

## Controller verification resolution

The controller reran the previously blocked checks in an environment with isolated PostgreSQL and SMTP loopback access:

- Focused Task 5 DB suite: 4 files, 13 tests passed, exit 0 (`task5-tests.out`).
- Full API suite: 43 files passed / 4 skipped; 251 tests passed / 29 skipped, exit 0 (`task5-full-tests.out`).

This resolves the local `TEST_DATABASE_URL` and SMTP `listen EPERM` verification concerns; they were sandbox limitations, not Task 5 failures.

## Review fix round 1

- Corrected invalid-link ordering: unknown, revoked, expired, and cancelled links now fail generically before scope handling, and owner-email configuration is evaluated only after a valid link and authorized mutable action.
- The customer action limiter now consumes the verified-client plus SHA-256 digest-prefix subject before validating token format, so malformed links receive the same quota treatment and generic response.
- Added the typed `customerRescheduleRequest` JSONB column to status events with generated migration `0004_slippery_kree.sql`, updated migration metadata/snapshot and isolated request-flow schema, and persist the structured `{date, startTime}` payload without altering the booking interval.
- Booking status history now selects `actorKind` and explicitly renders staff, customer, and system actors. Cart-order history was restored to its original staff-only inner-join semantics.

### TDD and verification evidence

1. Added route, service, structured request, and actor-history regression tests before the associated implementation changes.
2. RED:

   ```bash
   corepack pnpm --filter @yezz/api exec vitest run src/routes/v1/customer-bookings.routes.test.ts --config vitest.config.ts
   ```

   The malformed-token regression failed as expected because `customer_booking_action` had zero limiter calls.
3. GREEN/type checks:

   ```bash
   corepack pnpm --filter @yezz/api exec vitest run src/routes/v1/customer-bookings.routes.test.ts --config vitest.config.ts
   # 4 passed

   corepack pnpm --filter @yezz/db typecheck
   corepack pnpm --filter @yezz/db build
   corepack pnpm --filter @yezz/api typecheck
   # passed
   ```

4. The database-focused suites and migration suite are present but skipped locally without `TEST_DATABASE_URL`. The full API run had 34 files pass and only the two pre-existing SMTP loopback tests fail because this sandbox returns `listen EPERM: operation not permitted 127.0.0.1`. The full DB package run also hits sandbox `EPERM` when `tsx` attempts its IPC pipe. Controller rerun is required for isolated PostgreSQL and SMTP verification.

## Review fix round 1 follow-up

- Controller-local PostgreSQL verification found one fixture-only failure in the customer/system actor-history test. Its booking used the ordinary `cancellation_requested` status without ordinary evidence fields, so the mapper correctly treated it as legacy data.
- Added `participantCount`, `attendanceCount`, and `durationMinutes` to that fixture. No production mapper behavior changed.
- Follow-up local checks passed:

  ```bash
  corepack pnpm --filter @yezz/db build
  corepack pnpm --filter @yezz/api typecheck
  corepack pnpm --filter @yezz/api exec vitest run src/routes/v1/customer-bookings.routes.test.ts --config vitest.config.ts
  # 4 passed
  ```

## Review fix round 1 verification resolution

The controller reran the final checks with isolated PostgreSQL and SMTP loopback access:

- DB migration suite: 1 file, 2 tests passed, exit 0.
- Focused API suite: 4 files, 17 tests passed, exit 0.
- Full API suite: 43 files passed / 4 skipped; 255 tests passed / 29 skipped, exit 0.

Evidence: `task5-tests.out` and `task5-full-tests.out`. This resolves the remaining local sandbox-only database and SMTP concerns.
