# Task 8 Report — Product Request Scheduling and Status-Email Parity

## Scope and base

- Branch: `codex/yezyy-flow-task8-product`
- Integration base: `d5587d436a58f6d62e40a7067117f2c9b6d4784c`
- Task 4's authoritative, transactional, idempotent cart creation path was
  preserved.
- Task 5's atomic capacity repository, Task 6's event-bound email outbox, and
  Task 7's compare-and-set transition and accessible retry patterns were reused.
- No production system, real email provider, deployment, or external service
  was accessed or changed.

## Delivered

- Product request creation continues to submit catalogue project/style IDs
  only from the browser. The server loads each current catalogue project/style
  inside the create transaction, requires the project row to be a product,
  rejects cross-project styles, and stores authoritative project, style, price,
  and currency snapshots.
- There is no separate active/published product column in the approved schema.
  A current `diy_projects` row with `project_type = 'product'` is therefore the
  repository's active catalogue representation; no Task 8 schema invention was
  added.
- Cart-level name, phone, email, locale, people, authoritative Melbourne slot,
  exact date/start/end/timezone snapshots, capacity reservation, receipt
  outbox, and idempotent replay behavior from Task 4 remain unchanged.
- Added cart-order compare-and-set status transitions to the shared request
  transition service. Each transition requires `expectedStatus`,
  `operationId`, actor identity, target status, and optional note.
- Operation replay validates the complete operation identity and returns the
  original event without another status change, capacity mutation, or email.
  Reusing the operation ID for different data returns
  `OPERATION_ID_CONFLICT`.
- Stale status writes return `STATUS_CONFLICT` with the current status. Cart
  cancellation uses the shared conditional release in the same transaction and
  releases capacity exactly once.
- Cart transitions write actor-attributed status events and enqueue
  event-bound `cart_order_status_customer` messages transactionally for
  contacted, confirmed, and cancelled states. Legacy rows without email remain
  operable without creating a customer email.
- Admin list responses are paginated and expose email, people, exact slot,
  complete item/style/price/currency snapshots, and delivery summary.
- Admin detail responses additionally expose status history with actor/note/time
  and the complete delivery list.
- Both `/admin/orders/:id/status` and the compatibility
  `/admin/orders/:id` PATCH route require the compare-and-set body and use the
  authenticated staff actor.
- Chinese admin order list/detail now show tap-to-call/tap-to-email contact,
  Melbourne date and exact start/end, people, every item/style and currency,
  delivery state, status history, and safe localized errors.
- Status actions use the existing accessible modal. It retains one operation
  UUID and note across network retries, traps/restores focus, closes stale
  operations, refreshes the data, and focuses the surviving status control or
  page heading.
- No catalogue content was seeded or published, and no phone-case duration,
  style, or price was invented.

## TDD evidence

RED failures were observed before production implementation for:

- missing `transitionCartOrder`, so confirmation/cancellation could not use the
  shared status lifecycle;
- cart admin DTOs missing email, people, exact slot, item currency, history,
  and delivery state;
- the status route missing `/status` and dropping compare-and-set identity and
  actor data;
- the web API posting only a bare status to the legacy endpoint;
- the Chinese order list expecting an array and lacking schedule/contact/mail
  parity, an accessible status dialog, safe stale refresh, and focus recovery;
- the order detail omitting email, schedule, people, currency, history, and
  delivery state.

The focused tests were rerun GREEN after the corresponding minimal
implementation.

## Verification evidence

Safe local PostgreSQL run:

```text
TEST_DATABASE_URL=postgres://wesley@127.0.0.1:5432/yezyy_test
YEZYY_RUN_DB_BOOKING_TESTS=1
YEZYY_RUN_DB_SLOT_TESTS=1
YEZYY_RUN_DB_REPOSITORY_TESTS=1
YEZYY_RUN_RATE_LIMIT_DB_TESTS=1
corepack pnpm --filter @yezz/api test

Test Files  32 passed (32)
Tests       197 passed (197)
```

This includes authoritative cart snapshots/style ownership, idempotent create,
cart confirmation and cancellation emails, operation replay, exactly-once
capacity release, admin cart DTO parity, status events, outbox integrity,
capacity interleavings, and rate-limit persistence.

Full workspace verification:

```text
corepack pnpm verify
```

- workspace database/API/web typechecks passed;
- normal API suite passed: 23 files and 150 tests, with 9 guarded files and 47
  guarded tests skipped in the normal run;
- full web ESLint passed;
- database and API production builds passed;
- Next.js production build passed and generated 22 pages.

Full web suite:

```text
corepack pnpm --filter @yezz/web test

Test Files  25 passed (25)
Tests       93 passed (93)
```

Repository checks:

```text
git diff --check
```

Passed.

The Next.js build emitted only the existing monorepo-root,
middleware-deprecation, and local `NEXT_PUBLIC_USE_API` warnings. No warning
represented a compilation or page-generation failure.

## Independent-review focus fix

The independent review found one Important accessibility defect in the order
detail stale-conflict path. The dialog restored its opener, but a successful
refresh could remove that action and leave focus on `document.body`. A failed
refresh retained the action but left it disabled until the status update's
`finally`, so an early focus attempt was also insufficient.

The detail page now retains a pending focus request across the stale refresh and
the update `finally`. It focuses the first connected, enabled surviving status
action. When refreshed state removes every action, it focuses the connected
`tabIndex=-1` detail heading. The focus request is cleared only after the target
actually becomes `document.activeElement`.

RED regressions reproduced both failures against the real page:

- confirmed-to-cancelled stale refresh closed the dialog, rendered safe Chinese
  guidance, removed the cancellation action, and left focus on `body`;
- stale refresh transport failure retained the cancellation action, but no
  post-`finally` focus target existed.

Final focused and full-web evidence:

```text
Focused order detail/list/dialog:
  Test Files  3 passed (3)
  Tests       13 passed (13)

Full web:
  Test Files  25 passed (25)
  Tests       95 passed (95)

Web typecheck: passed
Targeted order-detail ESLint: passed
git diff --check: passed
```

Both page regressions assert that focus is connected and never `body`, stale
server/transport text is not rendered, and only the fixed safe Chinese
guidance is shown.
