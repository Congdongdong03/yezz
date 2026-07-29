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
