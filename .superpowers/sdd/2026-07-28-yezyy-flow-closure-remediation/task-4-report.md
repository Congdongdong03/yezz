# Task 4 Report — Idempotent Public Create Requests

## Scope and base

- Branch: `codex/yezyy-flow-task4-idempotency`
- Integration base: `831fb0073b2be52fac345229b8ec047bcf0e2d00`
- Task 7's booking attempt retention, PostgreSQL serialization, replay, and
  payload-conflict behavior was preserved and moved onto shared browser/API
  primitives where appropriate.
- No production system or external service was read or changed.
- PostgreSQL integration tests used a disposable local PostgreSQL 16 container
  and database named `yezyy_task4_test`.

## Delivered

- Added one browser request-attempt primitive shared by booking and cart.
  It creates one random UUID, retains it across client validation, network, and
  server failures, and rotates it only after an API response confirms success.
- The booking and cart forms retain their attempt object for the lifetime of
  the visible attempt. Cart submission now includes required email, people,
  date, and authoritative slot selection.
- Cart browser payloads contain catalogue project/style IDs only. Display names,
  types, and prices are not trusted create inputs.
- Both create routes require and normalize a UUID `Idempotency-Key`, pass it to
  their service, and keep HTTP `201 Created` for both the first result and an
  identical replay. The response's `replayed` field distinguishes the two.
- The same-origin BFF continues to forward the key and includes it in the
  signed request envelope; regression coverage now asserts the forwarded
  header explicitly.
- Added a shared PostgreSQL advisory-lock helper scoped by aggregate namespace:
  `booking-create:<key>` and `cart-order-create:<key>`.
- Cart creation now runs authoritative project/style lookup, exact-capacity
  reservation, order/item snapshots, and both acknowledgement outbox inserts
  in one database transaction.
- Cart replays compare the canonical accepted payload: normalized contact,
  email, message, locale, slot, people, optional preferred date, and ordered
  project/style IDs. Ignored client display data is intentionally not part of
  the canonical identity.
- An identical replay returns the existing resource with `replayed: true`
  without reserving capacity or inserting another order, item, or outbox row.
- Reusing the key for a different canonical payload returns
  `409 IDEMPOTENCY_KEY_CONFLICT`, including under concurrent ownership races.
- Direct cart repository creates are atomic: an item failure rolls back the
  parent order instead of leaving an orphan.

## HTTP replay policy

Both `POST /api/v1/bookings` and `POST /api/v1/cart-orders` return HTTP `201`
for a first create and for an identical replay. This preserves a stable
create-operation status for clients and existing integrations. Callers use
`data.replayed` to tell whether this response created the resource:

```json
{
  "success": true,
  "data": {
    "id": "existing-id",
    "status": "new",
    "replayed": true,
    "notification": "queued"
  }
}
```

## TDD evidence

RED failures were observed before implementation for:

- the missing shared browser attempt module;
- cart retry calls generating new keys rather than retaining one attempt key;
- booking and cart routes accepting missing/malformed keys;
- cart routes dropping the idempotency key instead of passing it to the
  service;
- cart duplicate requests creating two resource IDs;
- cart creates lacking `replayed` and queued-notification semantics;
- changed cart payloads reusing a key without a safe conflict;
- concurrent exact-capacity cart retries creating duplicate effects;
- direct repository item failure leaving its parent order committed.

The corresponding focused suites were rerun GREEN after each implementation
cycle.

## Verification

- `corepack pnpm --filter @yezz/web test`
  - 22 files passed, 89 tests passed.
- `corepack pnpm --filter @yezz/web lint`
  - passed with zero errors and zero warnings.
- `TEST_DATABASE_URL=<local-test-db> YEZYY_RUN_DB_BOOKING_TESTS=1 corepack pnpm --filter @yezz/api exec vitest run src/services/bookings.service.test.ts src/services/cart-orders.service.test.ts src/repositories/cart-orders.repository.test.ts`
  - 3 files passed, 17 tests passed.
  - Includes Task 7 booking replay/concurrency regressions plus cart sequential
    replay, concurrent exact-capacity replay, concurrent payload ownership,
    conflict/no-extra-effects, snapshot resolution, and repository rollback.
- `corepack pnpm verify`
  - workspace typecheck passed;
  - full ungated API suite passed;
  - web lint passed;
  - database and API builds passed;
  - Next.js production build passed.

Known build output is limited to the pre-existing Next.js workspace-root,
middleware-deprecation, and mock-data configuration warnings.

## Integration notes

- Keep the Task 7 booking service replay comparison and the shared
  `booking-create` advisory-lock namespace when resolving future booking work.
- Task 8 can build its cart admin/status-transition UI on the cart-level
  schedule, capacity reservation, server-derived item snapshots, and durable
  receipt outbox now established here.
- Replay responses intentionally remain HTTP `201`; changing them to `200`
  would be an API contract change and must be made for booking and cart
  together.
