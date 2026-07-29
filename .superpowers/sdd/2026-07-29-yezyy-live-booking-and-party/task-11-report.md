# Task 11 — Secure Owner Password Setup

## Outcome

The admin plaintext-password handoff has been replaced by an expiring,
one-use setup-link flow. Production bootstrap now creates the canonical
`congdongdong03@gmail.com` account as `owner` without accepting, returning, or
printing an owner password. Public experience, party, and product gates remain
unchanged and false.

No real owner password was requested, inspected, generated for handoff, or
entered. No production database, configuration, credential, deployment, or
public gate was changed.

## TDD evidence

Initial RED covered the removed plaintext response, owner authorization,
single-use setup, expiry, sibling revocation, session invalidation, route
availability, noindex UI, and durable email payload:

```text
users.admin.service.test.ts
3 failed: initialPassword was returned, admin could create admin,
sole-owner demotion was allowed

password-setup.service.test.ts
Failed to load: password-setup.service did not exist

auth.routes.test.ts
setup endpoint returned 404

auth/plugin tests
JWT omitted sessionVersion and stale JWT was accepted

setup-password/page.test.tsx
Failed to load: setup page did not exist
```

A final logging-boundary regression demonstrated that a storage exception
could expose the raw setup URL:

```text
expected PASSWORD_SETUP_ISSUE_FAILED
received "failing row contains https://yezyy.com/admin/setup-password?token=..."
```

The service now replaces unexpected issue/completion failures with safe
`AppError` messages, while the client receives the same non-enumerating
invalid/expired/already-used response for unusable tokens.

## Security design and implementation

- Setup tokens use 32 random bytes encoded as base64url. Only a SHA-256 digest
  is stored in `password_setup_tokens`; expiry is exactly 60 minutes.
- Issuance revokes prior active tokens and atomically queues the durable
  `admin_password_setup` email. Creation stores only a bcrypt-12 hash of an
  unreturned random 32-byte bootstrap password.
- Completion locks the active digest, updates the bcrypt hash, increments
  `users.session_version`, marks the token used, and revokes siblings in one
  transaction. Reuse and expiry return one generic response.
- JWTs carry the exact database session version. Auth middleware reloads the
  user and rejects missing, stale, or role-mismatched sessions.
- The setup route is IP rate-limited. Raw tokens are not returned by admin
  delivery APIs, logged by setup errors, written to localStorage, or sent to
  analytics.
- The setup page keeps the query token in memory, validates a 12-character
  minimum and matching confirmation, sets `noindex`, `nofollow`, and
  `no-referrer`, then replaces the form with a login link.
- API and UI responses no longer contain `initialPassword` or `newPassword`.
  Creating or resetting an admin user queues a setup email instead.
- Roles are `owner | admin | staff`. Only an owner can create or remove a
  privileged user, alter an owner account, or perform privileged role changes.
  The sole owner cannot be demoted or deleted.
- Production bootstrap is advisory-lock protected and idempotent. It creates
  and emails the canonical owner only when absent; an existing canonical
  account is promoted without exposing or replacing its password.
- The migration adds the setup-token schema and permits the new durable email
  type without changing any public capability gate.

## Verification

Fresh exact API command:

```text
Test Files  44 passed | 15 skipped (59)
Tests       307 passed | 130 skipped (437)
```

Fresh exact Web command:

```text
Test Files  48 passed (48)
Tests       205 passed (205)
```

Fresh exact database command:

```text
Test Files  2 passed | 3 skipped (5)
Tests       14 passed | 9 skipped (23)
```

Fresh static/build checks:

```text
corepack pnpm typecheck
exit 0: DB, Web, and API typechecks passed

corepack pnpm build:api
exit 0

git diff --check
exit 0
```

## Self-review

The token lifecycle, password change, and session-version change share
transactions at their security boundaries. Raw setup tokens exist only long
enough to build the durable recipient email; admin delivery responses redact
the payload. Unexpected persistence errors are replaced rather than propagated
because database error text can contain rejected row values.

The real PostgreSQL repository tests remain safely opt-in behind
`YEZYY_RUN_DB_BOOKING_TESTS=1`; the flag was unset, so those integration cases
were skipped rather than pointed at a non-dedicated database.

## Concern outside Task 11

`corepack pnpm build:api` passes. The default Web build first encounters the
repository's existing multi-worktree Turbopack root inference problem.
`next build --webpack` compiles Task 11 successfully, then Next's generated
route validation rejects the pre-existing exported helper
`handleBackendRequest` in
`apps/web/app/api/backend/[...path]/route.ts`. That route was not changed as
part of this task. Moving the generated `.next` directory aside restores the
clean-checkout `corepack pnpm typecheck` result above.

## Fix Round 1 — Analytics boundary, Owner serialization, and PostgreSQL fixture

### Review findings and verified root causes

1. `RootLayout` rendered `GoogleAnalytics` unconditionally. The setup form read
   the bearer token from `useSearchParams` but left it in
   `window.location`, so third-party analytics code executed in the same page
   while the Owner credential remained readable.
2. Owner demotion and deletion performed `findById`, `countByRole`, and the
   mutation as separate database operations. Two requests could both observe
   two Owners before either write and reduce the Owner count to zero.
3. The request-flow fixture copied the new setup-email constraint onto
   `request_status_events`, whose columns do not include `message_type` or
   `status_event_id`. Its actual `email_outbox` table retained the old
   exactly-one-parent check, rejecting a valid parentless setup email.

### RED evidence

Analytics and visible URL:

```text
NEXT_PUBLIC_GA_ID=G-SECURITY-REGRESSION \
  corepack pnpm --filter @yezz/web exec vitest run \
  app/admin/setup-password/page.test.tsx app/layout.test.tsx

Test Files  2 failed (2)
Tests       2 failed | 3 passed (5)

layout contained https://www.googletagmanager.com/gtag/js
location.search still contained ?token=<43-character test token>
```

Real PostgreSQL fixture:

```text
YEZYY_RUN_DB_BOOKING_TESTS=1 \
  corepack pnpm --filter @yezz/api exec vitest run \
  src/repositories/password-setup-tokens.repository.test.ts

Test Files  1 failed (1)
Tests       2 failed (2)
PostgresError: column "message_type" does not exist
```

The concurrency regression uses an isolated-schema trigger to pause both
Owner writes after their count. With the advisory lock removed, including in a
post-fix mutation check:

```text
Test Files  1 failed (1)
Tests       1 failed (1)
expected fulfilled results to have length 1, received 2
```

The trigger returns `NEW` for updates and `OLD` for deletes; this preserves
real mutation semantics while making the race deterministic.

### Fixes

- `GoogleAnalytics` now reads the pathname at the root-layout boundary and
  returns before rendering either Google Tag Manager script on
  `/admin/setup-password`.
- `SetupPasswordForm` copies the query credential into one immutable state
  value, then a layout effect deletes only the `token` parameter with
  `history.replaceState`, preserving unrelated query values and the fragment.
- The full-layout regression renders `RootLayout` with a non-empty GA ID and
  proves the setup route contains no external script, GA ID, `gtag`
  configuration, token transmission, data layer, or GA function.
- `users.repository.ts` now supplies a transaction-scoped, shared PostgreSQL
  advisory lock for privileged Owner mutations. Every role update re-reads,
  re-counts, and writes inside that locked transaction; every deletion does
  the same. At `READ COMMITTED`, the second waiter observes the first committed
  mutation and cannot remove the remaining Owner.
- A real PostgreSQL test runs a simultaneous Owner demotion and deletion. It
  requires exactly one success, one rejection, and one persisted Owner.
- The request-flow fixture restores the exactly-one-request constraint to
  `request_status_events` and applies the production migration's parentless
  `admin_password_setup` exception to `email_outbox`.
- Real PostgreSQL token tests now prove concurrent digest consumption has one
  winner, a setup token and parentless durable email persist together, raw
  token material is absent from the digest row, and invalid outbox validation
  rolls the token insertion back.

### GREEN verification

Analytics boundary and URL cleanup:

```text
NEXT_PUBLIC_GA_ID=G-SECURITY-REGRESSION \
  corepack pnpm --filter @yezz/web exec vitest run \
  app/layout.test.tsx app/admin/setup-password/page.test.tsx

Test Files  2 passed (2)
Tests       5 passed (5)
```

Dedicated PostgreSQL security cases, using an isolated local
`yezyy_closure_test` database with per-test schemas:

```text
YEZYY_RUN_DB_BOOKING_TESTS=1 \
  corepack pnpm --filter @yezz/api exec vitest run \
  src/repositories/password-setup-tokens.repository.test.ts \
  src/services/admin/users.admin.service.postgres.test.ts

Test Files  2 passed (2)
Tests       5 passed (5)

YEZYY_RUN_DB_MIGRATION_TESTS=1 \
  corepack pnpm --filter @yezz/db exec vitest run \
  src/bootstrap-production.test.ts \
  -t 'production bootstrap PostgreSQL integration'

Test Files  1 passed (1)
Tests       3 passed | 8 skipped (11)
```

Full regressions:

```text
corepack pnpm --filter @yezz/api test
Test Files  44 passed | 16 skipped (60)
Tests       307 passed | 133 skipped (440)

corepack pnpm --filter @yezz/web test
Test Files  49 passed (49)
Tests       207 passed (207)

corepack pnpm --filter @yezz/db test
Test Files  2 passed | 3 skipped (5)
Tests       14 passed | 9 skipped (23)
```

The DB suite was rerun alone for the result above. During one parallel
API/Web/DB invocation, its existing spawned `corepack` seed-guard test took
7.4 seconds and exceeded Vitest's five-second test timeout; alone it completed
in 3.13 seconds with no failure.

Static and build verification:

```text
corepack pnpm typecheck
exit 0: DB, Web, and API typechecks passed

corepack pnpm --filter @yezz/web lint -- \
  app/layout.test.tsx \
  app/admin/setup-password/SetupPasswordForm.tsx \
  app/admin/setup-password/page.test.tsx \
  components/analytics/GoogleAnalytics.tsx
exit 0

corepack pnpm build:api
exit 0

git diff --check
exit 0
```

### Remaining unrelated build limitation

The default `corepack pnpm build` still stops before compilation because
Turbopack selects the parent checkout's lockfile and cannot resolve
`next/package.json` from this worktree. The webpack fallback compiles the
application successfully in 20.0 seconds, then the generated Next route
validation rejects the pre-existing exported helper `handleBackendRequest` in
`apps/web/app/api/backend/[...path]/route.ts`. Neither failure originates in
the Task 11 fix files.

No production data, configuration, deployment, public gate, real password, or
real setup token was accessed or changed. The dedicated PostgreSQL container
uses a test-only database on local loopback with tmpfs storage.
