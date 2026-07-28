# YezYY Flow-Closure Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make experience, product, and party requests reliable from customer submission through Chinese-admin action, durable customer email, capacity accounting, and operational follow-up.

**Architecture:** Keep `bookings` for experience/party requests and `cart_orders` for multi-item product requests. Put a same-origin Next.js BFF in front of all browser mutations, persist rate limits/idempotency/status events/email delivery in PostgreSQL, and share slot/capacity/status primitives between both aggregates. Capability flags keep each public request path off until its own closure test passes.

**Tech Stack:** Next.js 16 route handlers/server actions, Fastify 5, PostgreSQL/Neon, Drizzle ORM, React 19, Resend, Vitest, Playwright, Mailpit, TypeScript.

## Global Constraints

- Public brand casing remains exactly `YezYY`.
- Canonical public origin remains exactly `https://yezyy.com`.
- Store timezone is exactly `Australia/Melbourne`.
- New prices default to `AUD`; explicit historical `CNY` values are not rewritten.
- Requests remain pending until Chinese-admin staff explicitly confirm or cancel them.
- No online payment is added; customers pay in store.
- No fictional catalogue or gallery content is inserted.
- New public requests require name, phone, email, people, an authoritative offering, and an authoritative time slot.
- Browser mutations must use the signed same-origin BFF in production.
- Capacity is reserved once when a pending request is created and released once only on cancellation.
- Production email failure is persisted and visible; it is never represented as successful delivery.
- Migrations are additive and previous-app compatible; rollback never deletes customer or delivery history.
- Public capability flags remain false until the corresponding closure E2E passes.

## File and Dependency Map

Foundation files changed before parallel work:

- `packages/db/migrations/0002_yezyy_flow_closure.sql` — additive production schema and backfill.
- `packages/db/src/schema/index.ts` — Drizzle declarations for new columns/tables.
- `packages/db/src/index.ts` — exports new schema types.

Shared runtime units:

- `apps/web/lib/internal-api/signature.ts` — BFF signing and client-address normalization.
- `apps/web/app/api/backend/[...path]/route.ts` — same-origin mutation/admin proxy.
- `apps/api/src/lib/internal-request.ts` — verifies BFF envelopes.
- `apps/api/src/repositories/rate-limits.repository.ts` — durable atomic buckets.
- `apps/api/src/lib/slot-policy.ts` — Melbourne date/time/business-hours rules.
- `apps/api/src/repositories/request-capacity.repository.ts` — atomic reserve/release.
- `apps/api/src/repositories/status-events.repository.ts` — operation idempotency/audit.
- `apps/api/src/repositories/email-outbox.repository.ts` — durable mail queue.
- `apps/api/src/services/email-outbox.service.ts` — claim/send/retry state machine.
- `apps/api/src/repositories/admin-request-reads.repository.ts` — per-user read state.

Request-specific units remain in their existing service/repository folders. Do not create a third universal request service.

## Sequencing and Parallel Slices

Task 1 is the shared database foundation and runs first.

After Task 1:

- Slice A: Tasks 2–3 (BFF trust and durable rate limiting), then Task 4.
- Slice B: Task 5 (time-slot invariants and capacity).
- Slice C: Task 6 (email outbox).
- Slice D: Task 11 (AUD/bootstrap) can run independently.

After Tasks 5 and 6:

- Task 7 closes experience/admin booking.
- Task 8 closes product/cart.
- Task 9 closes party booking after Task 7.

Task 10 depends on Tasks 7–9. Task 12 depends on all prior tasks. Tasks that modify `packages/db/src/schema/index.ts` must not run in parallel.

---

### Task 1: Add the Forward Database Foundation

**Files:**
- Create: `packages/db/migrations/0002_yezyy_flow_closure.sql`
- Create: `packages/db/migrations/meta/0002_snapshot.json`
- Create: `packages/db/src/schema/flow-closure.type-test.ts`
- Create: `packages/db/src/migrations/flow-closure.migration.test.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/migrations/meta/_journal.json`
- Modify: `packages/db/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: booking/cart slot snapshots and idempotency columns.
- Produces: `requestRateLimits`, `requestStatusEvents`, `emailOutbox`, and `adminRequestReads`.
- Produces: time-slot checks, uniqueness, and restrictive request foreign keys.
- Produces: AUD database default.

- [ ] **Step 1: Add a compile-time failing schema contract**

```ts
import {
  adminRequestReads,
  bookings,
  cartOrders,
  emailOutbox,
  requestRateLimits,
  requestStatusEvents,
} from "./index.js";

void bookings.requestKind;
void bookings.slotStartTime;
void bookings.idempotencyKey;
void cartOrders.timeSlotId;
void cartOrders.idempotencyKey;
void requestRateLimits.subjectHash;
void requestStatusEvents.operationId;
void emailOutbox.deliveryStatus;
void adminRequestReads.userId;
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/db typecheck
```

Expected: fail because the new declarations do not exist.

- [ ] **Step 3: Declare the additive schema**

Use `varchar` checks for request/delivery kinds and keep new business fields nullable or defaulted for rolling compatibility. Add these exact uniqueness rules in SQL:

```sql
CREATE UNIQUE INDEX bookings_idempotency_key_unique
  ON bookings (idempotency_key);
CREATE UNIQUE INDEX cart_orders_idempotency_key_unique
  ON cart_orders (idempotency_key);
CREATE UNIQUE INDEX request_status_events_operation_id_unique
  ON request_status_events (operation_id);
CREATE UNIQUE INDEX email_outbox_dedupe_key_unique
  ON email_outbox (dedupe_key);
CREATE UNIQUE INDEX time_slots_effective_slot_unique
  ON time_slots (
    date,
    start_time,
    end_time,
    COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
```

Add constraints:

```sql
ALTER TABLE time_slots
  ADD CONSTRAINT time_slots_capacity_positive CHECK (capacity >= 1),
  ADD CONSTRAINT time_slots_booked_nonnegative CHECK (booked_count >= 0),
  ADD CONSTRAINT time_slots_booked_within_capacity CHECK (booked_count <= capacity),
  ADD CONSTRAINT time_slots_time_format CHECK (
    start_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    AND end_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  ADD CONSTRAINT time_slots_time_order CHECK (start_time < end_time);
```

Replace request slot foreign keys with `ON DELETE RESTRICT`. Add exact-one-parent checks to status/read tables.

- [ ] **Step 4: Backfill without inventing data**

```sql
UPDATE bookings b
SET request_kind = 'experience',
    idempotency_key = COALESCE(idempotency_key, gen_random_uuid()),
    slot_date = COALESCE(b.slot_date, t.date, b.preferred_date),
    slot_start_time = COALESCE(b.slot_start_time, t.start_time),
    slot_end_time = COALESCE(b.slot_end_time, t.end_time),
    slot_timezone = COALESCE(b.slot_timezone, 'Australia/Melbourne')
FROM time_slots t
WHERE b.time_slot_id = t.id;

UPDATE bookings
SET idempotency_key = COALESCE(idempotency_key, gen_random_uuid()),
    slot_date = COALESCE(slot_date, preferred_date),
    slot_timezone = COALESCE(slot_timezone, 'Australia/Melbourne');

UPDATE cart_orders
SET idempotency_key = COALESCE(idempotency_key, gen_random_uuid()),
    slot_timezone = COALESCE(slot_timezone, 'Australia/Melbourne');

ALTER TABLE diy_projects
  ALTER COLUMN price_currency SET DEFAULT 'AUD';
UPDATE diy_projects SET price_currency = 'AUD' WHERE price_currency IS NULL;
```

Run validation queries before adding checks; fail the migration with a clear exception when an existing slot violates capacity/time invariants.

- [ ] **Step 5: Verify empty and legacy migration paths**

Add Vitest to `@yezz/db` and a `test` script if it is not already present. The
migration test creates isolated schemas in a non-production PostgreSQL test
database, applies `0000` through `0002`, asserts the backfill, and drops only
those generated schemas.

Run:

```bash
corepack pnpm --filter @yezz/db build
corepack pnpm --filter @yezz/db typecheck
corepack pnpm --filter @yezz/db test -- src/migrations/flow-closure.migration.test.ts
```

Apply all migrations to an empty test database and to a fixture containing one legacy booking with a slot and one without a slot. Assert the first receives exact start/end snapshots and the second retains null times.

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "feat: add request flow database foundation"
```

### Task 2: Add Signed Same-Origin Browser Transport

**Files:**
- Create: `apps/web/lib/internal-api/signature.ts`
- Create: `apps/web/lib/internal-api/signature.test.ts`
- Create: `apps/web/app/api/backend/[...path]/route.ts`
- Create: `apps/web/app/api/backend/[...path]/route.test.ts`
- Create: `apps/api/src/lib/internal-request.ts`
- Create: `apps/api/src/lib/internal-request.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/lib/auth-cookie.ts`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/lib/actions/booking.ts`
- Modify: `apps/web/lib/actions/cart.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `signInternalRequest(input, secret): SignedInternalHeaders`.
- Produces: `verifyInternalRequest(request, rawBody, secrets): VerifiedClientIdentity`.
- Produces: same-origin `/api/backend/*` transport.
- Consumes: server-only `WEB_API_SHARED_SECRET`.

- [ ] **Step 1: Write failing canonical-signature tests**

```ts
it("signs method, target, identity, idempotency key, and body", () => {
  const signed = signInternalRequest({
    method: "POST",
    pathAndQuery: "/api/v1/bookings",
    requestId: "00000000-0000-4000-8000-000000000001",
    timestamp: 1_785_200_000,
    clientIp: "203.0.113.4",
    idempotencyKey: "00000000-0000-4000-8000-000000000002",
    body: new TextEncoder().encode('{"name":"A"}'),
  }, "test-secret");

  expect(signed["x-yezyy-client-ip"]).toBe("203.0.113.4");
  expect(signed["x-yezyy-body-sha256"]).toMatch(/^[a-f0-9]{64}$/);
  expect(signed["x-yezyy-signature"]).toMatch(/^[a-f0-9]{64}$/);
});

it("rejects a changed body and an expired timestamp", async () => {
  await expect(verifyFixture({ body: '{"name":"B"}' }))
    .rejects.toMatchObject({ code: "INVALID_INTERNAL_SIGNATURE" });
  await expect(verifyFixture({ now: 1_785_200_301 }))
    .rejects.toMatchObject({ code: "EXPIRED_INTERNAL_SIGNATURE" });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/internal-api
corepack pnpm --filter @yezz/api test -- src/lib/internal-request.test.ts
```

- [ ] **Step 3: Implement BFF signing and CSRF checks**

The route handler must:

```ts
if (isUnsafeMethod(request.method)) {
  assertSameOrigin(request.headers.get("origin"), getCanonicalSiteOrigin());
}
const clientIp = readTrustedPlatformIp(request.headers, process.env.VERCEL === "1");
const body = new Uint8Array(await request.arrayBuffer());
const signed = signInternalRequest({ method, pathAndQuery, requestId, timestamp, clientIp, idempotencyKey, body }, secret);
```

Strip inbound `x-yezyy-*`, `host`, and forwarding headers. Forward only an allowlist plus the signed headers. Pass the API `Set-Cookie` response through without a `Domain` attribute so the browser stores a host-only cookie on `yezyy.com`.

Use `SameSite=Lax` for the API cookie because browsers now receive it from the same-origin BFF.

- [ ] **Step 4: Require verified transport incrementally**

Add `INTERNAL_REQUEST_ENFORCEMENT=log|require`. In `log` mode, log only request ID/path/result, never raw IP/body/signature. In `require` mode, protect:

- `/api/v1/auth/login`
- `/api/v1/auth/logout`
- all `/api/v1/admin/*`
- `POST /api/v1/bookings`
- `POST /api/v1/cart-orders`

Public GET routes remain directly readable.

- [ ] **Step 5: Verify cookie, CSRF, and spoof protection**

Tests must prove:

- an inbound fake `x-yezyy-client-ip` is removed;
- a production request without a trusted platform IP fails closed;
- an unsafe cross-origin BFF request returns 403;
- a valid login `Set-Cookie` is first-party, `HttpOnly`, `Secure`, and `SameSite=Lax`;
- upload bytes and JSON bodies both verify.

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/internal-api app/api/backend
corepack pnpm --filter @yezz/api test -- src/lib/internal-request.test.ts src/lib/auth-cookie.test.ts
corepack pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web apps/api .env.example
git commit -m "feat: add signed same-origin api transport"
```

### Task 3: Replace Process-Local Public Limits with PostgreSQL Buckets

**Files:**
- Create: `apps/api/src/repositories/rate-limits.repository.ts`
- Create: `apps/api/src/repositories/rate-limits.repository.test.ts`
- Create: `apps/api/src/services/rate-limits.service.ts`
- Create: `apps/api/src/services/rate-limits.service.test.ts`
- Modify: `apps/api/src/routes/v1/bookings.routes.ts`
- Modify: `apps/api/src/routes/v1/cart-orders.routes.ts`
- Modify: `apps/api/src/routes/v1/auth.routes.ts`
- Modify: `apps/api/src/routes/v1/admin/index.ts`
- Modify: `apps/api/src/plugins/services.ts`
- Modify: `apps/api/src/lib/public-request-limit.ts`

**Interfaces:**
- Produces: `consume(scope, subject, limit, windowSeconds): Promise<RateLimitResult>`.
- Consumes: verified client IP from Task 2 and `RATE_LIMIT_HASH_SECRET`.

- [ ] **Step 1: Write failing isolation and atomicity tests**

```ts
it("does not let one customer consume another customer's bucket", async () => {
  await consumeFive("203.0.113.4");
  await expect(service.consume("booking", "203.0.113.5", 5, 3600))
    .resolves.toMatchObject({ allowed: true, remaining: 4 });
});

it("allows exactly five concurrent requests", async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.consume("booking", "203.0.113.4", 5, 3600),
    ),
  );
  expect(results.filter((result) => result.allowed)).toHaveLength(5);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/rate-limits.service.test.ts
```

- [ ] **Step 3: Implement atomic buckets**

Use one PostgreSQL statement with `ON CONFLICT ... DO UPDATE` and return count/expiry. Hash subjects:

```ts
const subjectHash = createHmac("sha256", hashSecret)
  .update(`${scope}\n${normalizedSubject}`)
  .digest("hex");
```

Login consumes `login-ip-email` at 5/hour and `login-ip` at 30/hour. Admin limits use `request.user.sub`; public limits use `request.verifiedClient.ip`.

- [ ] **Step 4: Fail closed in production**

Remove production use of `inMemoryRateLimit`. If the repository fails, throw:

```ts
new AppError(503, "RATE_LIMIT_UNAVAILABLE", "Please try again shortly.");
```

Continue sending `Retry-After` for 429 responses.

- [ ] **Step 5: Verify routes and commit**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/repositories/rate-limits.repository.test.ts src/services/rate-limits.service.test.ts src/routes/v1/bookings.routes.test.ts
corepack pnpm typecheck
```

```bash
git add apps/api
git commit -m "fix: make request limits durable per customer"
```

### Task 4: Make Public Create Requests Idempotent

**Files:**
- Create: `apps/web/lib/requests/idempotency.ts`
- Create: `apps/web/lib/requests/idempotency.test.ts`
- Modify: `apps/web/components/book/BookingForm.tsx`
- Modify: `apps/web/app/[locale]/cart/page.tsx`
- Modify: `apps/web/lib/actions/booking.ts`
- Modify: `apps/web/lib/actions/cart.ts`
- Modify: `apps/api/src/routes/v1/bookings.routes.ts`
- Modify: `apps/api/src/routes/v1/cart-orders.routes.ts`
- Modify: `apps/api/src/repositories/bookings.repository.ts`
- Modify: `apps/api/src/repositories/cart-orders.repository.ts`

**Interfaces:**
- Produces: one UUID idempotency key per form attempt, retained across retry and replaced after success.
- Produces: API responses with `{ replayed: boolean }`.

- [ ] **Step 1: Write failing browser-key lifecycle tests**

```ts
it("keeps the same key after failure and rotates after success", () => {
  const attempt = createRequestAttempt(() => "key-1");
  expect(attempt.current()).toBe("key-1");
  attempt.failed();
  expect(attempt.current()).toBe("key-1");
  attempt.succeeded(() => "key-2");
  expect(attempt.current()).toBe("key-2");
});
```

- [ ] **Step 2: Write failing repository replay tests**

```ts
it("returns the original request for a duplicate idempotency key", async () => {
  const first = await repository.create(validInput, "same-key");
  const second = await repository.create(validInput, "same-key");
  expect(second.row.id).toBe(first.row.id);
  expect(second.replayed).toBe(true);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/requests/idempotency.test.ts
corepack pnpm --filter @yezz/api test -- src/repositories/bookings.repository.test.ts src/repositories/cart-orders.repository.test.ts
```

- [ ] **Step 4: Implement the contract**

Require a UUID `Idempotency-Key` on both create routes. Insert it inside the same transaction as capacity/outbox work. On unique conflict, fetch by key and return:

```json
{ "id": "existing-id", "status": "new", "replayed": true, "notification": "queued" }
```

Never rerun reservation or enqueueing for a replay.

- [ ] **Step 5: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/requests
corepack pnpm --filter @yezz/api test -- src/repositories/bookings.repository.test.ts src/repositories/cart-orders.repository.test.ts
corepack pnpm typecheck
```

```bash
git add apps/web apps/api
git commit -m "fix: make public requests idempotent"
```

### Task 5: Enforce Time-Slot and Atomic Capacity Invariants

**Files:**
- Create: `apps/api/src/lib/slot-policy.ts`
- Create: `apps/api/src/lib/slot-policy.test.ts`
- Create: `apps/api/src/repositories/request-capacity.repository.ts`
- Create: `apps/api/src/repositories/request-capacity.repository.test.ts`
- Modify: `apps/api/src/repositories/time-slots.repository.ts`
- Modify: `apps/api/src/services/time-slots.service.ts`
- Modify: `apps/api/src/services/bookings.service.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`

**Interfaces:**
- Produces: `assertSlotAllowed(input, now): void`.
- Produces: `reserve(slotId, people, tx)` and `release(slotId, people, tx)`.
- Produces: immutable `SlotSnapshot`.

- [ ] **Step 1: Write failing slot-policy tests**

```ts
it.each([
  ["2026-07-27", "10:00", "11:00", "past"],
  ["2026-07-30", "08:30", "09:30", "outside business hours"],
  ["2026-07-30", "11:00", "10:00", "end must be after start"],
])("rejects %s %s-%s", (date, startTime, endTime) => {
  expect(() => assertSlotAllowed(
    { date, startTime, endTime, capacity: 2 },
    new Date("2026-07-28T00:00:00+10:00"),
  )).toThrow();
});
```

- [ ] **Step 2: Write failing capacity concurrency tests**

```ts
it("never reserves beyond capacity", async () => {
  const results = await Promise.allSettled([
    repo.reserve(slot.id, 2),
    repo.reserve(slot.id, 2),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect((await slots.findById(slot.id))?.bookedCount).toBe(2);
});

it("never releases below zero", async () => {
  await expect(repo.release(slot.id, 1))
    .rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
});
```

- [ ] **Step 3: Implement policy and overlap checks**

Use the approved weekly hours from the design and Melbourne-local date comparison. Serialize create/batch checks by an advisory transaction lock derived from effective category/date, then reject:

```sql
existing.start_time < :new_end
AND existing.end_time > :new_start
```

Exclude the current row on update. Public availability queries exclude dates before Melbourne today.

- [ ] **Step 4: Replace read-then-increment arithmetic**

Implement reserve/release as conditional `UPDATE ... RETURNING`. On zero rows, throw `SLOT_FULL` or `CAPACITY_CONFLICT`. Stop calling `incrementBookedCount`.

Prevent deletion of a referenced slot and prevent start/end/category edits after `booked_count > 0`; instruct staff to close the slot and create a replacement.

- [ ] **Step 5: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/lib/slot-policy.test.ts src/repositories/request-capacity.repository.test.ts src/services/time-slots.service.test.ts
corepack pnpm typecheck
```

```bash
git add apps/api
git commit -m "fix: enforce slot and capacity invariants"
```

### Task 6: Add Durable Email Outbox and Admin Observability

**Files:**
- Create: `apps/api/src/repositories/email-outbox.repository.ts`
- Create: `apps/api/src/repositories/email-outbox.repository.test.ts`
- Create: `apps/api/src/services/email-outbox.service.ts`
- Create: `apps/api/src/services/email-outbox.service.test.ts`
- Create: `apps/api/src/routes/v1/admin/email-deliveries.routes.ts`
- Create: `apps/web/app/admin/email-deliveries/page.tsx`
- Create: `apps/web/lib/admin/email-delivery.ts`
- Create: `apps/web/lib/admin/email-delivery.test.ts`
- Modify: `apps/api/src/lib/email.ts`
- Modify: `apps/api/src/plugins/services.ts`
- Modify: `apps/api/src/routes/v1/admin/index.ts`
- Modify: `apps/api/src/startup.ts`
- Modify: `apps/web/components/admin/AdminShell.tsx`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/lib/admin/types.ts`

**Interfaces:**
- Produces: `enqueue(input, tx)`, `claimDue(limit)`, `markSent`, `markFailed`, and `retry`.
- Produces: 30-second worker with five-minute leases.
- Produces: Chinese failed/pending/sent delivery list and retry action.

- [ ] **Step 1: Write failing outbox state-machine tests**

```ts
it("deduplicates the same business message", async () => {
  const first = await repo.enqueue({ ...message, dedupeKey: "booking:1:received:customer" });
  const second = await repo.enqueue({ ...message, dedupeKey: "booking:1:received:customer" });
  expect(second.id).toBe(first.id);
});

it("moves a transient failure to the next bounded retry", async () => {
  await service.deliverOne(pending, rejectingProvider({ statusCode: 503 }));
  expect(await repo.findById(pending.id)).toMatchObject({
    deliveryStatus: "pending",
    attemptCount: 1,
  });
});

it("does not retry a sent message", async () => {
  await expect(service.retry(sent.id))
    .rejects.toMatchObject({ code: "EMAIL_ALREADY_SENT" });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/email-outbox.service.test.ts
```

- [ ] **Step 3: Implement transactional queueing and provider results**

Store typed template inputs in `payload`. Claim with `FOR UPDATE SKIP LOCKED`. Use retry delays:

```ts
export const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240] as const;
```

Make the Resend adapter return `providerMessageId` and throw when the SDK response contains an error. Redact stored errors to status/code and 300 safe characters.

- [ ] **Step 4: Start and stop the worker safely**

When `EMAIL_OUTBOX_WORKER_ENABLED=true`, drain at startup and every 30 seconds; clear the timer on Fastify close. Do not overlap polls. Production startup still requires `EMAIL_FROM`, `EMAIL_REPLY_TO`, `OWNER_EMAIL`, and `RESEND_API_KEY`.

- [ ] **Step 5: Build admin delivery visibility**

Add paginated failed/pending/sent filters, aggregate/request links, attempt count, last attempt, and retry. Use these Chinese labels:

```ts
const LABELS = {
  pending: "等待发送",
  processing: "发送中",
  sent: "已发送",
  failed: "发送失败",
} as const;
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/repositories/email-outbox.repository.test.ts src/services/email-outbox.service.test.ts
corepack pnpm --filter @yezz/web test -- lib/admin/email-delivery.test.ts
corepack pnpm --filter @yezz/web exec eslint app/admin/email-deliveries lib/admin/email-delivery.ts
corepack pnpm typecheck
```

```bash
git add apps/api apps/web
git commit -m "feat: persist and monitor email delivery"
```

### Task 7: Close the Experience Booking and Admin Status Loop

**Files:**
- Create: `apps/api/src/repositories/status-events.repository.ts`
- Create: `apps/api/src/repositories/status-events.repository.test.ts`
- Create: `apps/api/src/services/request-transition.service.ts`
- Create: `apps/api/src/services/request-transition.service.test.ts`
- Modify: `apps/api/src/repositories/bookings.repository.ts`
- Modify: `apps/api/src/services/bookings.service.ts`
- Modify: `apps/api/src/services/bookings.service.test.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`
- Create: `apps/api/src/services/admin/bookings.admin.service.test.ts`
- Modify: `apps/api/src/routes/v1/admin/bookings.routes.ts`
- Modify: `apps/web/lib/admin/types.ts`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/app/admin/bookings/page.tsx`
- Modify: `apps/web/app/admin/bookings/[id]/page.tsx`
- Modify: `apps/web/components/admin/BookingStatusDialog.tsx`

**Interfaces:**
- Produces: authoritative booking `offering`, `slot`, `statusHistory`, and `notificationSummary`.
- Produces: compare-and-set transition `{ expectedStatus, operationId, status, note }`.
- Consumes: atomic capacity from Task 5 and outbox from Task 6.

- [ ] **Step 1: Write failing preferred-date and DTO tests**

```ts
it("rejects a preferred date that disagrees with the locked slot", async () => {
  await expect(service.create({
    ...validExperience,
    timeSlotId: slot.id,
    preferredDate: "2026-08-13",
  }, idempotencyKey)).rejects.toMatchObject({ code: "DATE_SLOT_MISMATCH" });
});

it("returns exact immutable slot details to admin", async () => {
  expect(await adminService.getById(booking.id, staff.id)).toMatchObject({
    preferredDate: "2026-08-12",
    slot: {
      id: slot.id,
      date: "2026-08-12",
      startTime: "10:00",
      endTime: "11:00",
      timeZone: "Australia/Melbourne",
    },
  });
});
```

- [ ] **Step 2: Write failing transition concurrency tests**

```ts
it("releases capacity once for concurrent cancellation", async () => {
  const outcomes = await Promise.allSettled([
    transition({ ...cancel, operationId: "op-1" }),
    transition({ ...cancel, operationId: "op-2" }),
  ]);
  expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect((await slots.findById(slot.id))?.bookedCount).toBe(0);
});

it("replays the same operation without a second email", async () => {
  const first = await transition({ ...confirm, operationId: "same-op" });
  const second = await transition({ ...confirm, operationId: "same-op" });
  expect(second).toMatchObject({ id: first.id, replayed: true });
  expect(await outbox.countForEvent(first.eventId)).toBe(1);
});
```

- [ ] **Step 3: Implement authoritative creation**

For an experience request, require `projectId`, load the project, require `projectType === "experience"`, reserve capacity, derive `preferredDate` and slot snapshots from the slot, snapshot project name/price, insert the booking, and enqueue owner/customer acknowledgement in one transaction.

- [ ] **Step 4: Implement status event/CAS transaction**

Update only when `status = expectedStatus`; insert one event and one customer status-email row. On conflict return:

```json
{
  "success": false,
  "error": {
    "code": "STATUS_CONFLICT",
    "message": "The request changed. Refresh and try again.",
    "details": { "currentStatus": "confirmed" }
  }
}
```

- [ ] **Step 5: Render exact details in Chinese admin**

List/detail must show date and `startTime–endTime`, offering snapshot, email, people, delivery badge, and status history. Use a new operation UUID per dialog submission and retain it across network retry.

- [ ] **Step 6: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/bookings.service.test.ts src/services/request-transition.service.test.ts src/services/admin/bookings.admin.service.test.ts
corepack pnpm --filter @yezz/web test -- components/admin/BookingStatusDialog.test.tsx
corepack pnpm --filter @yezz/web exec eslint app/admin/bookings components/admin/BookingStatusDialog.tsx
corepack pnpm typecheck
```

```bash
git add apps/api apps/web
git commit -m "feat: close the experience booking loop"
```

### Task 8: Give Product Requests Scheduling and Status-Email Parity

**Files:**
- Modify: `apps/web/lib/cart/types.ts`
- Modify: `apps/web/lib/cart/items.ts`
- Modify: `apps/web/components/projects/ProjectDetail.tsx`
- Modify: `apps/web/app/[locale]/cart/page.tsx`
- Modify: `apps/web/lib/actions/cart.ts`
- Modify: `apps/api/src/repositories/projects.repository.ts`
- Modify: `apps/api/src/repositories/cart-orders.repository.ts`
- Modify: `apps/api/src/services/cart-orders.service.ts`
- Create: `apps/api/src/services/cart-orders.service.test.ts`
- Modify: `apps/api/src/services/admin/cart-orders.admin.service.ts`
- Create: `apps/api/src/services/admin/cart-orders.admin.service.test.ts`
- Modify: `apps/api/src/routes/v1/admin/orders.routes.ts`
- Modify: `apps/web/lib/admin/types.ts`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/app/admin/orders/page.tsx`
- Modify: `apps/web/app/admin/orders/[id]/page.tsx`

**Interfaces:**
- Public items are exactly `{ projectId: string; styleId?: string }`.
- Produces: one cart-level slot/people/contact and server-derived item snapshots.
- Consumes: capacity, transition, event, and outbox primitives.

- [ ] **Step 1: Write failing server-authority tests**

```ts
it("ignores client display fields and snapshots the database project/style", async () => {
  const created = await service.create({
    ...validCart,
    items: [{ projectId: phoneCase.id, styleId: pinkStyle.id }],
  }, idempotencyKey);
  expect(await repo.findItemsByOrderId(created.id)).toEqual([
    expect.objectContaining({
      projectName: phoneCase.name,
      projectType: "product",
      styleName: pinkStyle.name,
      price: pinkStyle.price,
      priceCurrency: "AUD",
    }),
  ]);
});

it("rejects a style from another project", async () => {
  await expect(service.create({
    ...validCart,
    items: [{ projectId: phoneCase.id, styleId: lampStyle.id }],
  }, idempotencyKey)).rejects.toMatchObject({ code: "STYLE_PROJECT_MISMATCH" });
});
```

- [ ] **Step 2: Write failing schedule/status parity tests**

Assert cart create reserves once, admin DTO includes email/exact slot, confirmed/cancelled transitions enqueue the correct customer template, and cancellation restores capacity once.

- [ ] **Step 3: Simplify the browser cart contract**

Remove client name/type/price snapshots from submission. Add one required calendar/time selector, people field, and email field to checkout. Keep display-only cart data locally, but submit IDs only.

- [ ] **Step 4: Create atomically from authoritative data**

Within one transaction:

1. load every project and optional style;
2. reject non-product projects or style mismatch;
3. reserve the selected slot;
4. insert the cart order and server snapshots;
5. enqueue owner/customer acknowledgement.

- [ ] **Step 5: Reuse compare-and-set status lifecycle**

Change the admin PATCH body to include `expectedStatus`, `operationId`, and `note`. Show customer email, exact slot, people, delivery state, and history in Chinese admin.

- [ ] **Step 6: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/cart-orders.service.test.ts src/services/admin/cart-orders.admin.service.test.ts src/services/request-transition.service.test.ts
corepack pnpm --filter @yezz/web test -- lib/cart
corepack pnpm --filter @yezz/web exec eslint app/[locale]/cart app/admin/orders components/projects/ProjectDetail.tsx
corepack pnpm typecheck
```

```bash
git add apps/api apps/web
git commit -m "feat: close the product request loop"
```

### Task 9: Persist Party Requests Through the Booking Lifecycle

**Files:**
- Modify: `apps/web/components/parties/PartyInquiryCTA.tsx`
- Create: `apps/web/components/parties/PartyBookingForm.tsx`
- Create: `apps/web/components/parties/PartyBookingForm.test.tsx`
- Modify: `apps/web/app/[locale]/parties/page.tsx`
- Modify: `apps/web/lib/actions/booking.ts`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`
- Modify: `apps/api/src/services/bookings.service.ts`
- Modify: `apps/api/src/services/bookings.service.test.ts`
- Modify: `apps/api/src/repositories/bookings.repository.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`

**Interfaces:**
- Produces: booking create union `{ kind: "experience" } | { kind: "party" }`.
- Party requires `partyPackageId`, slot, people, and contact.
- Consumes: complete booking lifecycle from Task 7.

- [ ] **Step 1: Write failing party validation tests**

```ts
it.each([1, 21])("rejects people outside the package range: %s", async (people) => {
  await expect(service.create({
    ...validPartyRequest,
    numberOfPeople: people,
  }, idempotencyKey)).rejects.toMatchObject({ code: "PARTY_SIZE_INVALID" });
});

it("stores a party package snapshot and queues acknowledgement", async () => {
  const result = await service.create(validPartyRequest, idempotencyKey);
  expect(await repo.findById(result.id)).toMatchObject({
    requestKind: "party",
    partyPackageId: party.id,
    offeringNameSnapshot: party.name,
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/bookings.service.test.ts
corepack pnpm --filter @yezz/web test -- components/parties/PartyBookingForm.test.tsx
```

- [ ] **Step 3: Add the party form**

Reuse the existing calendar slot data and contact controls. Enforce package min/max client-side for usability and server-side for authority. Copy must say manual confirmation and pay in store; do not add advance-payment/refund wording.

- [ ] **Step 4: Persist through bookings**

Load the package, validate size, reserve slot, snapshot name/price indicator, enqueue initial mail, and surface the record in admin with `聚会预约` and package details.

- [ ] **Step 5: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/bookings.service.test.ts src/services/admin/bookings.admin.service.test.ts
corepack pnpm --filter @yezz/web test -- components/parties
corepack pnpm --filter @yezz/web exec eslint components/parties app/[locale]/parties
corepack pnpm typecheck
```

```bash
git add apps/api apps/web
git commit -m "feat: add closed-loop party requests"
```

### Task 10: Add Per-Staff Read State, Pagination, Search, and Queue Counters

**Files:**
- Create: `apps/api/src/repositories/admin-request-reads.repository.ts`
- Create: `apps/api/src/repositories/admin-request-reads.repository.test.ts`
- Modify: `apps/api/src/repositories/notifications.repository.ts`
- Modify: `apps/api/src/services/admin/notifications.admin.service.ts`
- Modify: `apps/api/src/routes/v1/admin/notifications.routes.ts`
- Modify: `apps/api/src/repositories/bookings.repository.ts`
- Modify: `apps/api/src/repositories/cart-orders.repository.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`
- Modify: `apps/api/src/services/admin/cart-orders.admin.service.ts`
- Modify: `apps/web/app/admin/page.tsx`
- Modify: `apps/web/app/admin/bookings/page.tsx`
- Modify: `apps/web/app/admin/orders/page.tsx`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/lib/admin/types.ts`

**Interfaces:**
- Produces: per-user `markBookingRead`/`markCartOrderRead`.
- Produces: paginated/filterable queues and operational summary.

- [ ] **Step 1: Write failing read-isolation test**

```ts
it("keeps a request unread for another staff member", async () => {
  await repo.markBookingRead(staffA.id, booking.id);
  expect(await repo.isBookingUnread(staffA.id, booking.id)).toBe(false);
  expect(await repo.isBookingUnread(staffB.id, booking.id)).toBe(true);
});
```

- [ ] **Step 2: Write failing pagination/summary tests**

Seed 31 mixed records. Assert page 1 returns 25, page 2 returns 6, totals remain 31, status/search filters change both data and total, overdue means `new` older than two hours, and confirmed-today uses Melbourne calendar date.

- [ ] **Step 3: Replace global mark-read**

Remove `markBookingsRead()`/`markOrdersRead()`. Detail GET receives `request.user.sub` and upserts only that record's receipt. List GET never marks records.

- [ ] **Step 4: Implement the queue UI**

Add 25-row pages, search/filter query state, total pages, unresolved-first sorting, record unread indicator, and dashboard links for unseen/new/contacted/overdue/confirmed today/email failures.

- [ ] **Step 5: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/repositories/admin-request-reads.repository.test.ts src/services/admin/notifications.admin.service.test.ts src/services/admin/bookings.admin.service.test.ts src/services/admin/cart-orders.admin.service.test.ts
corepack pnpm --filter @yezz/web exec eslint app/admin/page.tsx app/admin/bookings app/admin/orders
corepack pnpm typecheck
```

```bash
git add apps/api apps/web
git commit -m "feat: make admin requests an operational queue"
```

### Task 11: Separate Production Bootstrap from Demo Seed and Finish AUD Persistence

**Files:**
- Create: `packages/db/src/bootstrap-production.ts`
- Create: `packages/db/src/bootstrap-production.test.ts`
- Move: `packages/db/src/seed.ts` to `packages/db/src/seed-dev-demo.ts`
- Modify: `packages/db/package.json`
- Modify: `apps/api/src/repositories/projects.repository.ts`
- Create: `apps/api/src/repositories/projects.repository.test.ts`
- Modify: `deploy.sh`
- Modify: `docker-compose.prod.yml`
- Modify: `docs/production-config-checklist.md`

**Interfaces:**
- Produces: `seed:dev-demo`, which refuses production.
- Produces: guarded, idempotent `bootstrap:production`.
- Produces: explicit AUD writes for project create/update.

- [ ] **Step 1: Write failing production-safety tests**

```ts
it("creates settings/admin without catalogue, party, or gallery rows", async () => {
  await bootstrapProduction(validGuardedEnv);
  expect(await counts()).toEqual({
    settings: 1,
    admins: 1,
    categories: 0,
    projects: 0,
    parties: 0,
    gallery: 0,
  });
});

it("rejects placeholders and missing guard", async () => {
  await expect(bootstrapProduction({ ...env, ALLOW_PRODUCTION_BOOTSTRAP: "" }))
    .rejects.toThrow("ALLOW_PRODUCTION_BOOTSTRAP=YezYY");
  await expect(bootstrapProduction({ ...env, ADMIN_PASSWORD: "changeme" }))
    .rejects.toThrow("placeholder credentials");
});
```

- [ ] **Step 2: Write failing AUD repository test**

```ts
it("writes AUD when currency is omitted", async () => {
  const project = await repository.create(validProject);
  expect(project?.priceCurrency).toBe("AUD");
});
```

- [ ] **Step 3: Implement safe commands**

Expose:

```json
{
  "seed:dev-demo": "tsx src/seed-dev-demo.ts",
  "bootstrap:production": "tsx src/bootstrap-production.ts"
}
```

The dev seed throws when `NODE_ENV=production`. Production bootstrap requires exact guard and explicit non-placeholder admin credentials only when no admin exists. It never deletes rows or prints the password.

- [ ] **Step 4: Rewire deployment**

`deploy.sh --init` and the Compose setup profile invoke migration plus `bootstrap:production`; no production service invokes demo seed or `FORCE_SEED`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
corepack pnpm --filter @yezz/db test -- src/bootstrap-production.test.ts
corepack pnpm --filter @yezz/api test -- src/repositories/projects.repository.test.ts
corepack pnpm typecheck
```

```bash
git add packages/db apps/api deploy.sh docker-compose.prod.yml docs/production-config-checklist.md
git commit -m "fix: make production bootstrap truthful"
```

### Task 12: Add Closure E2E, Feature Gates, and Staged Release Checks

**Files:**
- Create: `docker-compose.test.yml`
- Create: `apps/web/e2e/fixtures/mailpit.ts`
- Create: `apps/web/e2e/experience-closure.spec.ts`
- Create: `apps/web/e2e/product-closure.spec.ts`
- Create: `apps/web/e2e/party-closure.spec.ts`
- Create: `apps/web/e2e/rate-limit-identity.spec.ts`
- Create: `apps/web/e2e/email-retry.spec.ts`
- Modify: `apps/api/src/services/settings.service.ts`
- Modify: `apps/api/src/services/settings.service.test.ts`
- Modify: `apps/web/lib/api/types.ts`
- Modify: `apps/web/components/book/BookingForm.tsx`
- Modify: `apps/web/components/projects/ProjectDetail.tsx`
- Modify: `apps/web/components/parties/PartyInquiryCTA.tsx`
- Modify: `apps/web/app/[locale]/cart/page.tsx`
- Modify: `apps/web/playwright.config.ts`
- Modify: `package.json`
- Modify: `docs/production-config-checklist.md`

**Interfaces:**
- Produces: API-enforced `requestCapabilities`.
- Produces: deterministic PostgreSQL + Mailpit closure suite.
- Produces: explicit Fly/Vercel staged release runbook.

- [ ] **Step 1: Write failing capability tests**

```ts
it("defaults every public request capability to false", async () => {
  expect((await service.get()).requestCapabilities).toEqual({
    experience: false,
    product: false,
    party: false,
  });
});

it("rejects a disabled request server-side", async () => {
  await expect(createExperience()).rejects.toMatchObject({
    statusCode: 503,
    code: "REQUEST_FLOW_DISABLED",
  });
});
```

- [ ] **Step 2: Add PostgreSQL and Mailpit test services**

Use a non-production database and Mailpit SMTP/API. Tests must generate unique request IDs and delete only their own fixture rows during teardown. No test configuration may contain the production database URL or Resend key.

- [ ] **Step 3: Implement one same-record E2E per flow**

Each test must:

1. submit through the public UI;
2. capture the returned request ID;
3. log into Chinese admin through the BFF;
4. open that exact ID and assert authoritative slot/offering/contact;
5. change status with an operation ID;
6. assert the matching customer email in Mailpit;
7. assert final database capacity and event/outbox state.

The product cancellation test repeats the same operation and proves capacity is restored once.

- [ ] **Step 4: Test identity and delivery failure**

Send six requests as identity A and one as identity B. Assert A's sixth is 429 with `Retry-After`, while B succeeds. Configure Mailpit failure for one recipient, assert the failure appears in Chinese admin, retry it, and assert sent state.

- [ ] **Step 5: Gate public CTAs**

When a capability is false, render the approved phone/email contact state. The API must also reject the mutation. Turn no flag on in committed production defaults.

- [ ] **Step 6: Run the complete local gate**

Run:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm test:api
corepack pnpm --filter @yezz/web test
corepack pnpm --filter @yezz/web lint
corepack pnpm build:api
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_USE_API=true NEXT_PUBLIC_SITE_URL=http://localhost:3000 corepack pnpm build
corepack pnpm test:e2e:closure
git diff --check
```

Expected: all commands pass; Mailpit contains test-only messages; no production request exists.

- [ ] **Step 7: Add staged deployment checklist**

Record:

1. current app commit and Neon restore point;
2. preflight invariant queries;
3. Fly migration/API deploy with capabilities false and signature mode `log`;
4. Vercel BFF deploy with shared secret;
5. cookie/CSRF/per-IP verification;
6. Fly signature mode `require`;
7. email outbox worker verification;
8. experience enablement and smoke check;
9. product enablement and smoke check;
10. party enablement and smoke check;
11. deployed commit IDs and rollback commands.

Do not submit a real production request without explicit owner authorization.

- [ ] **Step 8: Commit**

```bash
git add apps/api apps/web docker-compose.test.yml package.json docs/production-config-checklist.md
git commit -m "test: verify complete request closure"
```

## Final Review Gate

Before merging or deploying:

- run a fresh spec-compliance review for every task;
- run a fresh code-quality/security review of the combined diff;
- confirm no route accepts unsigned browser mutations in enforcement mode;
- confirm no create route trusts client price/name/style/date/time;
- confirm no capacity mutation uses read-then-write arithmetic;
- confirm every business transition and email has a persisted record;
- confirm all capability flags remain false in default production configuration;
- confirm the production bootstrap contains no mock import or placeholder credential fallback;
- confirm secret scan output is clean.

## External Authorization Checkpoint

Implementation and local verification can finish without owner input. Pause before these production actions:

- adding/rotating `WEB_API_SHARED_SECRET` in Vercel and Fly;
- using a Neon restore point or production migration;
- adding Resend DNS records or changing the verified sender;
- deploying Fly/Vercel production;
- enabling any public request capability;
- creating a controlled production request.
