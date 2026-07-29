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
