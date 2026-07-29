# Capability Gate Linearization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make committed database capability closures linearizable with every legacy, ordinary, and dedicated-party public create, while keeping rejected disabled requests out of durable rate-limit state.

**Architecture:** `site_settings` becomes a database-enforced singleton, with deterministic selection and conflict-safe initialization. A public create acquires `FOR SHARE` on that row inside its write transaction; this acquisition is the create linearization point. The same transaction consumes the durable request limit and writes booking/outbox state. Admin capability updates use the conflicting row update lock, so either the create commits first and closure waits, or closure commits first and the create observes disabled before rate-limit mutation.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL 16, Vitest.

## Global Constraints

- Modify only capability gate linearization, singleton settings correctness, and booking-route limiter placement.
- Do not modify schedule, logging, age policy/version, party email/cancellation, E2E helpers, or the runbook.
- Preserve product-request hard closure.
- Prove concurrency with a real isolated PostgreSQL schema and condition-based lock observation.
- Preserve unrelated dirty worktree files and stage only this fix's exact file set.

---

### Task 1: Reproduce the Commit-Order Race

**Files:**
- Create: `apps/api/src/routes/v1/capability-linearization.integration.test.ts`
- Modify: `apps/api/src/test-utils/request-flow-postgres.ts`

**Interfaces:**
- Consumes: `createRequestFlowTestDatabase()` and real booking/settings/rate-limit services.
- Produces: a real-PostgreSQL regression covering legacy experience, ordinary experience, and dedicated party creates.

- [ ] **Step 1: Add isolated named PostgreSQL connections**

Extend `RequestFlowTestDatabase` with:

```ts
openConnection(applicationName: string): ReturnType<typeof createDb>;
```

Each returned connection must reuse only that fixture's random schema, set a unique PostgreSQL `application_name`, be tracked, and close during fixture cleanup.

- [ ] **Step 2: Write the failing concurrent route test**

For each public booking shape:

```ts
it.each(["legacy", "ordinary", "party"])(
  "does not commit %s after a committed database closure",
  async (kind) => {
    // Hold an uncommitted admin UPDATE on the singleton settings row.
    // Hold a test-only advisory lock reached by a BEFORE INSERT trigger.
    // Start the real Fastify route with real settings, limiter, and booking services.
    // Observe its named PostgreSQL connection waiting on a lock.
    // Commit the capability closure, then release the insert blocker.
    // Expect REQUEST_FLOW_DISABLED and zero booking/outbox/rate-limit rows.
  },
);
```

The production change that makes this test pass is moving the capability row lock and limiter mutation into the create transaction. The existing unlocked implementation must fail with a `201` and committed booking/outbox/rate-limit rows.

- [ ] **Step 3: Run the test to verify RED**

Run:

```bash
YEZYY_RUN_DB_BOOKING_TESTS=1 TEST_DATABASE_URL="$SAFE_LOCAL_TEST_URL" \
  corepack pnpm --filter @yezz/api exec vitest run \
  src/routes/v1/capability-linearization.integration.test.ts
```

Expected: all three cases fail because the create can commit after the admin closure.

### Task 2: Enforce and Migrate the Settings Singleton

**Files:**
- Modify: `packages/db/src/schema/index.ts`
- Create: generated `packages/db/migrations/0006_*.sql`
- Create: generated `packages/db/migrations/meta/0006_snapshot.json`
- Modify: `packages/db/migrations/meta/_journal.json`
- Create: `packages/db/src/migrations/capability-linearization.migration.test.ts`
- Modify: `apps/api/src/test-utils/request-flow-postgres.ts`
- Modify: `apps/api/src/repositories/settings.repository.ts`

**Interfaces:**
- Produces: `siteSettings.singletonKey`, deterministic `findSingleton({ lock })`, conflict-safe `upsertSingleton`.
- Consumes: PostgreSQL `FOR SHARE` / `FOR UPDATE`.

- [ ] **Step 1: Write failing migration and repository behavior tests**

The migration test must start with duplicate legacy rows, apply the new migration, and assert:

```ts
expect(rows).toHaveLength(1);
expect(rows[0].experience_requests_enabled).toBe(false);
await expect(insertSecondRow()).rejects.toMatchObject({ code: "23505" });
```

The deterministic survivor is the latest `(updated_at, created_at, id)` row, while all capability booleans are folded fail-closed across duplicates.

- [ ] **Step 2: Run the tests to verify RED**

Expected: the migration artifact and singleton column do not exist.

- [ ] **Step 3: Add schema and generated migration**

Add a checked/default-true singleton key and unique index. Before creating the unique index, lock `site_settings`, deterministically retain the latest row, fold duplicate capability flags with `bool_and`, and delete other rows. Do not fabricate a row in an unbootstrapped database.

- [ ] **Step 4: Make repository behavior deterministic and conflict-safe**

Implement:

```ts
findSingleton(options?: { lock?: "share" | "update" })
upsertSingleton(data)
updateSingleton(data)
```

`findSingleton` filters the singleton key, orders deterministically, and applies the requested PostgreSQL lock. `upsertSingleton` inserts with `ON CONFLICT (singleton_key) DO UPDATE`.

- [ ] **Step 5: Run migration/repository tests to verify GREEN**

Run the isolated migration test and settings/API typecheck.

### Task 3: Put Gate, Limiter, and Booking in One Transaction

**Files:**
- Modify: `apps/api/src/services/settings.service.ts`
- Modify: `apps/api/src/services/admin/settings.admin.service.ts`
- Modify: `apps/api/src/repositories/rate-limits.repository.ts`
- Modify: `apps/api/src/services/rate-limits.service.ts`
- Modify: `apps/api/src/lib/public-request-limit.ts`
- Modify: `apps/api/src/services/bookings.service.ts`
- Modify: `apps/api/src/services/party-workflow.service.ts`
- Modify: `apps/api/src/routes/v1/bookings.routes.ts`
- Modify: directly affected tests only.

**Interfaces:**
- Produces: optional transaction parameter on durable limiter consumption and a route-supplied `beforePersist(tx)` callback for booking creates.
- Consumes: `findSingleton({ lock: "share" })`.

- [ ] **Step 1: Add failing unit contracts**

Assert that a route passes its limiter callback into every booking create shape, and that a disabled locked capability throws before invoking the callback.

- [ ] **Step 2: Run focused tests to verify RED**

Expected: current route consumes before dispatch and create methods do not accept the callback.

- [ ] **Step 3: Implement transactional limiter plumbing**

Allow:

```ts
rateLimits.consume(scope, subject, limit, windowSeconds, tx);
enforceRequestLimit(service, scope, subject, limit, windowSeconds, reply, tx);
```

The repository executes its existing atomic SQL through `tx` when supplied.

- [ ] **Step 4: Establish the documented create linearization point**

Inside every legacy/ordinary/dedicated-party create transaction:

```ts
const settings = await settingsRepository.findSingleton({ lock: "share" });
requireEffectiveRequestCapability(kind, settings, env);
await beforePersist?.(tx);
```

The shared row lock remains held until booking and outbox commit. Replay paths dispatched by the public route also enter this transaction so the limiter contract is unchanged.

- [ ] **Step 5: Serialize admin switch mutation**

Run `updateRequestSwitches` in a transaction, resolve/initialize the singleton using the same repository, lock it for update, mutate that exact row, then invalidate cache after commit.

- [ ] **Step 6: Run focused tests and the real concurrent suite**

Expected: disabled requests return `503`, all three concurrent cases leave zero booking/outbox/rate-limit rows, and normal enabled creates persist exactly one rate-limit bucket.

### Task 4: Verify and Commit

**Files:**
- Review only the exact files listed above.

- [ ] **Step 1: Run fresh verification**

Run:

```bash
corepack pnpm --filter @yezz/db typecheck
corepack pnpm --filter @yezz/api typecheck
corepack pnpm --filter @yezz/api exec vitest run <focused-files>
YEZYY_RUN_DB_BOOKING_TESTS=1 TEST_DATABASE_URL="$SAFE_LOCAL_TEST_URL" \
  corepack pnpm --filter @yezz/api exec vitest run \
  src/routes/v1/capability-linearization.integration.test.ts
YEZYY_RUN_DB_MIGRATION_TESTS=1 TEST_DATABASE_URL="$SAFE_LOCAL_TEST_URL" \
  corepack pnpm --filter @yezz/db exec vitest run \
  src/migrations/capability-linearization.migration.test.ts
```

- [ ] **Step 2: Review scope and diff**

Confirm no unrelated dirty file is staged, no prohibited subsystem changed, and the migration is fail-closed for duplicate settings capabilities.

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(api): linearize public capability closure"
```
