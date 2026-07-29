# Task 10 — Chinese Operational Admin

## Design plan before UI implementation

### Subject, audience, and job

This is the daily operations surface for YezYY counter staff in Glen Waverley.
Its single job is to let staff see studio pressure in Melbourne time and take
the next valid booking action without mentally translating system states.

### Compact tokens

- `纸白 #FFFFFF`: primary work surface and calendar body.
- `雾灰 #F5F3F2`: app background and non-operating time.
- `炭墨 #302F2F`: primary copy and high-priority counts.
- `铅灰 #6E6968`: secondary labels and inactive structure.
- `YezYY 粉 #D96F9E`: selected day, focus emphasis, and active workflow action.
- `告警朱 #B5473F`: destructive actions and email/schedule conflicts only.

Typography keeps the existing loaded families: restrained Noto Serif SC for
the `YezYY 运营台` identity and day/date anchors; Inter with the platform CJK
fallback for controls and prose; tabular Inter numerals for times, capacity,
money, and deadlines. No new font or dependency is introduced.

### Layout

The desktop shell becomes a compact two-rail operations frame: a narrow
Chinese navigation rail, then a wide workbench. The calendar is a true
seven-column, 30-minute matrix with time labels at the left; blocks span rows
instead of becoming unrelated dashboard cards. Mobile keeps a sticky date
strip and horizontally scrollable day workbench so time relationships remain
intact.

```text
┌ YezYY 运营台 ┬  本周排班  7月29日—8月4日  [今天] [‹] [›] ┐
│ 今日运营     ├────┬────┬────┬────┬────┬────┬────┤
│ 预约处理     │ 周三│ 周四│ 周五│ 周六│ 周日│ 周一│ 周二│
│ 周排班       ├────┼────┼────┼────┼────┼────┼────┤
│ 邮件异常  2  │09:30│ 3/8│    │派对准备│闭店│    │    │
│ 营业设置     │10:00│ 6/8│    │派对进行│闭店│特开│    │
└──────────────┴────┴────┴────┴────┴────┴────┴────┘
```

### Signature

The memorable element is the **capacity ledger cell**: every operating
half-hour exposes `已到 / 上限` and `剩余` as aligned figures, while party
setup, guest, and cleanup occupy visibly connected but structurally distinct
segments. Pink marks the current operational focus, not decoration.

### Self-critique against generic dashboard defaults

The first instinct—summary cards above a pastel calendar—would be a generic
SaaS dashboard and would push the actual timetable below the fold. It is
removed. There is no hero, metric-card row, gradient, decorative illustration,
floating glass panel, or oversized rounded container. Status and capacity are
encoded by row span, labels, borders, and tabular numbers; colour is redundant
support. The existing cream/caramel public-site styling is quieted inside the
operations workbench to neutral paper/grey, with the existing YezYY pink
reserved for focus and active actions. Motion is limited to existing control
feedback and must disappear under `prefers-reduced-motion`.

## TDD evidence

### Calendar read model

RED:

```text
FAIL booking-calendar.repository.test.ts
Cannot find module './booking-calendar.repository.js'
```

The repository did not exist. The subsequent real PostgreSQL GREEN command is
correctly protected by `YEZYY_RUN_DB_BOOKING_TESTS=1` and the existing safe
test-database guard, but the managed sandbox refused its localhost connection:

```text
connect EPERM 127.0.0.1:5432
```

The test remains a real PostgreSQL integration test (not a mock) and covers
overlapping confirmed attendance, active party hold phases, remaining
capacity, payment deadline, special hours, partial closure, and failed email.
With the DB flag closed it typechecks and is safely skipped.

### Capability and schedule services

RED:

```text
settings.service.test.ts
expected product false, received true

settings.admin.service.test.ts
readEffectiveAdminSwitches is not a function
```

GREEN:

```text
Test Files  2 passed (2)
Tests       5 passed | 2 skipped (7)
```

The skipped tests are the real PostgreSQL schedule/conflict cases behind the
same isolated flag. The runnable tests prove hard-gate/database AND semantics,
separate admin switch states, and permanently false product effectiveness.

### Structured schedule routes

RED:

```text
settings.routes.test.ts
GET /schedule and all new write routes returned 404
```

GREEN:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
```

### Canonical booking operations

RED:

```text
bookings.routes.test.ts
calendar/action endpoints returned 404
stale response returned STATUS_CONFLICT instead of STALE_STATUS

bookings.admin.service.test.ts
validateBookingCalendarRange is not a function

party-workflow.service.test.ts
charge input lacked operation identity/replay support
```

GREEN:

```text
Test Files  3 passed (3)
Tests       14 passed | 30 skipped (44)
```

The runnable route tests prove the calendar contract, all four canonical write
families, mandatory operation fields, and safe `409 STALE_STATUS` with
`currentStatus`. PostgreSQL workflow tests remain behind the isolated DB flag.
The hard-gate regression for the live party entry point was separately observed
RED (invalid-input TypeError escaped before gate evaluation) and GREEN:

```text
Test Files  1 passed (1)
Tests       8 passed | 22 skipped (30)
```

### Chinese operational Web

Each new UI artifact began with a missing-module RED:

```text
BookingWorkflowDialog.test.tsx  import failed: module missing
BusinessHoursEditor.test.tsx    import failed: module missing
admin/schedule/page.test.tsx    import failed: page missing
```

The status module also failed on the old stale message, missing action map, and
missing Melbourne DST conversion. The booking list initially exposed the old
four-state select.

Focused GREEN:

```text
Test Files  5 passed (5)
Tests       16 passed (16)
```

These tests cover action-specific fields, waitlist contact confirmation,
in-store venue-fee recording, seven weekday pairs, special/partial closures,
three-layer switches, product lockout, 30-minute capacity rows, party phases,
deadlines, closures, email failures, booking links, removal of the state
dropdown, safe stale refresh, and winter/summer Melbourne timestamp conversion.

## Files and decisions

- Added a calendar repository with an inclusive maximum-seven-day read model,
  half-open interval overlap, ordinary max-eight capacity ledger, active party
  phase blocks, schedule bands, deadlines, booking numbers, and email failures.
- Added canonical admin routes:
  `GET /bookings/calendar`, and `POST /:id/transitions|charges|payment|refund`.
  Every canonical write requires `expectedStatus` and `operationId`.
- Made variable party charges replay-safe by recording an immutable same-status
  operation event before returning `replayed`; the same operation cannot insert
  a second charge or be reused with another payload.
- Added schedule read/update, special hours, closure create/delete, and request
  switch routes. Full-day and partial closures return `SCHEDULE_CONFLICT` with
  formatted affected booking numbers unless explicitly acknowledged. The
  override only writes schedule data and never edits bookings.
- Public settings now derive effective experience/party availability from both
  the deployment hard gate and current database row even when contact settings
  are cached. The live party create path rechecks the DB gate before replay and
  again inside the locked transaction. Product is forced false in effective
  settings, admin writes, UI, and production service wiring.
- Replaced list/detail generic state controls with valid action buttons and one
  action-specific dialog. Successful actions re-read the booking and its
  affected calendar day. Stale writes display exactly
  `记录已被其他操作更新，请查看最新状态`.
- Added the compact Chinese seven-day workbench, structured hours editor, and a
  responsive operations shell. All displayed and submitted operational times
  use Australia/Melbourne; local datetime inputs are converted with DST-aware
  `Intl` resolution before API submission.
- Added staff-visible email failure counts in calendar cells and a dedicated
  notification summary endpoint linking to failed delivery operations.

## Verification

Fresh final API focus:

```text
node_modules/.bin/vitest run \
  src/repositories/booking-calendar.repository.test.ts \
  src/services/admin/bookings.admin.service.test.ts \
  src/services/admin/settings.admin.service.test.ts \
  src/services/settings.service.test.ts \
  src/services/bookings.service.test.ts \
  src/services/party-workflow.service.test.ts \
  src/routes/v1/admin/bookings.routes.test.ts \
  src/routes/v1/admin/settings.routes.test.ts

Test Files  7 passed | 1 skipped (8)
Tests       29 passed | 55 skipped (84)
```

The skipped file/cases are exclusively existing real-PostgreSQL suites behind
their opt-in flag.

Fresh final Web focus:

```text
node_modules/.bin/vitest run \
  lib/admin/booking-status.test.ts \
  components/admin/BookingWorkflowDialog.test.tsx \
  components/admin/BusinessHoursEditor.test.tsx \
  app/admin/bookings/page.test.tsx \
  app/admin/schedule/page.test.tsx

Test Files  5 passed (5)
Tests       16 passed (16)
```

Fresh type and static verification:

```text
apps/api/node_modules/.bin/tsc --noEmit
apps/web/node_modules/.bin/tsc --noEmit
packages/db/node_modules/.bin/tsc --noEmit
apps/web/node_modules/.bin/eslint .
git diff --check
```

All completed with exit code 0 and no diagnostics.

## Concerns

No schema migration is required: the existing live-booking foundation already
stores ordinary attendance, party phase times, structured schedule rows,
request switches, deadlines, charges, and email delivery state.

The only environment limitation is the managed sandbox's `EPERM` denial for a
localhost PostgreSQL socket. Consequently real PostgreSQL tests were written
behind the required isolated flag and their initial missing-module RED was
observed, but their database GREEN cannot be truthfully claimed in this
environment. No production data, deployment, credential, secret, install,
public-gate value, or product-sale value was touched.

## Fix round 1 — independent review

### Findings and root causes

1. The workflow dialog always returned `finalDate` and `finalStartTime`, but
   both booking pages only mapped them to canonical `newDate` and
   `newStartTime` when the old status was `reschedule_requested`. The ordinary
   service repeated that restriction, so pending-review and waitlisted
   confirmations could silently keep the old slot.
2. The schedule page used grid-flow columns containing separate per-day lists,
   then appended party cards after each list. There was no shared row
   coordinate for cross-day comparison or party/closure placement.
3. The canonical mutation routes called `safeWrite`, while every retained
   legacy alias directly called the underlying service. Their `409` contracts
   therefore diverged.
4. The list and detail success handlers fetched a calendar day without storing
   or rendering it. There was no client calendar cache shared with the schedule
   page, so the successful response had no observable consumer.

### RED evidence

API command:

```text
node_modules/.bin/vitest run \
  src/services/request-transition.service.test.ts \
  src/routes/v1/admin/bookings.routes.test.ts

Test Files  2 failed (2)
Tests       9 failed | 6 passed | 15 skipped (30)
```

The ordinary confirmation test received
`TypeError: db.transaction is not a function` instead of the required
pre-transaction `VALIDATION_ERROR`. All eight legacy-alias cases returned
`STATUS_CONFLICT` without `details.currentStatus` instead of
`STALE_STATUS`.

Web command:

```text
node_modules/.bin/vitest run \
  app/admin/bookings/page.test.tsx \
  app/admin/schedule/page.test.tsx

Test Files  2 failed (2)
Tests       2 failed | 5 passed (7)
```

The pending-review confirmation call omitted `newDate` and `newStartTime`.
The schedule had no `role="grid"`, shared time row, or time-aligned phase and
closure spans.

The cache regression then began with a missing-module RED:

```text
Failed to resolve import "@/lib/admin/calendar-store"
Test Files  1 failed (1)
Tests       no tests
```

### Fixes and files

- `apps/api/src/services/request-transition.service.ts` now requires a final
  date/start for every ordinary transition to `confirmed`, builds and
  validates the selected interval for pending-review, waitlisted, and
  reschedule confirmations, and persists the interval before its CAS status
  change.
- `apps/api/src/services/request-transition.service.test.ts` adds the runnable
  pre-transaction validation regression and updates real-PostgreSQL
  confirmation cases with explicit final slots.
- `apps/web/app/admin/bookings/page.tsx` and
  `apps/web/app/admin/bookings/[id]/page.tsx` always forward the selected final
  slot for an ordinary confirm, replace their local booking from the
  authoritative detail response, refresh the affected calendar day, and write
  that response to the shared calendar cache.
- `apps/web/app/admin/bookings/page.test.tsx` proves a pending-review
  confirmation forwards the changed final slot, replaces the rendered booking
  with the authoritative response, and stores the refreshed calendar day.
- `apps/web/lib/admin/calendar-store.ts` provides the shared day cache,
  subscription, and range-merge boundary. The schedule subscribes to that
  cache, so a refreshed day updates any rendered matching week instead of
  being discarded.
- `apps/web/app/admin/schedule/page.tsx` now renders one shared half-hour time
  rail and seven day columns in a single horizontally scrollable CSS grid.
  Ordinary capacity cells share row coordinates across days; closures and
  party setup/guest/cleanup phases occupy their actual start/end row spans.
- `apps/web/app/admin/schedule/page.test.tsx` proves the unique shared time row
  and exact grid spans for the closure and all three party phases.
- `apps/api/src/routes/v1/admin/bookings.routes.ts` retains compatibility
  aliases but routes every mutation through the same operation validation and
  `safeWrite` stale-response normalization as canonical mutations.
- `apps/api/src/routes/v1/admin/bookings.routes.test.ts` covers both legacy
  status aliases and all six legacy party actions, requiring
  `409 STALE_STATUS` plus the authoritative `currentStatus`.

### GREEN evidence

API:

```text
node_modules/.bin/vitest run \
  src/services/request-transition.service.test.ts \
  src/routes/v1/admin/bookings.routes.test.ts \
  src/services/admin/bookings.admin.service.test.ts

Test Files  3 passed (3)
Tests       23 passed | 22 skipped (45)
```

Web:

```text
node_modules/.bin/vitest run \
  app/admin/bookings/page.test.tsx \
  app/admin/schedule/page.test.tsx \
  components/admin/BookingWorkflowDialog.test.tsx

Test Files  3 passed (3)
Tests       10 passed (10)
```

Static verification:

```text
apps/api/node_modules/.bin/tsc --noEmit
apps/web/node_modules/.bin/tsc --noEmit
apps/web/node_modules/.bin/eslint \
  app/admin/bookings/page.tsx \
  'app/admin/bookings/[id]/page.tsx' \
  app/admin/bookings/page.test.tsx \
  app/admin/schedule/page.tsx \
  app/admin/schedule/page.test.tsx \
  lib/admin/calendar-store.ts
git diff --check
```

All completed with exit code 0 and no diagnostics. The real PostgreSQL tests
remain opt-in behind `YEZYY_RUN_DB_BOOKING_TESTS=1`; no production data or
configuration was touched in this fix round.

## Fix round 2 — off-cadence schedule boundaries

### Root cause

The first shared-matrix implementation rounded the axis origin down to a
half-hour and computed grid lines with elapsed minutes divided by 30. This
worked only when every day shared that origin. A valid `09:45–10:15` capacity
interval was absent from a `09:30, 10:00, …` lookup, while a valid `10:15`
closure boundary produced a fractional CSS grid line.

The API/editor contract deliberately accepts any increasing `HH:MM` pair, so
the Web grid—not the schedule contract—had to preserve those real boundaries.

### RED evidence

```text
node_modules/.bin/vitest run app/admin/schedule/page.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 3 passed (4)
```

The new regression supplied a `09:45` opening/capacity interval, `10:15`
partial closure, and off-cadence party phases. The capacity block was missing,
so its text and row span were `undefined`; the old arithmetic would also have
produced fractional closure/party grid lines.

### Files and fix

- `apps/web/app/admin/schedule/page.tsx` now builds a shared axis from the
  sorted union of every actual opening, closing, interval, closure, and party
  phase boundary plus the 30-minute cadence between the earliest and latest
  boundaries.
- Grid placement now looks up each real boundary's integer index. A missing
  boundary is an explicit programming error; no boundary is silently rounded.
- Ordinary capacity is rendered as a start/end row-spanning block, so a
  30-minute interval remains intact even when another day's boundary splits
  the shared rail into smaller visual segments.
- `apps/web/app/admin/schedule/page.test.tsx` covers the off-cadence capacity,
  closure, setup, guest, and cleanup spans and asserts that every emitted
  `grid-row` consists only of integer grid lines.

### GREEN and final Web verification

Focused regression:

```text
node_modules/.bin/vitest run app/admin/schedule/page.test.tsx

Test Files  1 passed (1)
Tests       4 passed (4)
```

Task 10 Web suite and static checks:

```text
node_modules/.bin/vitest run \
  lib/admin/booking-status.test.ts \
  components/admin/BookingWorkflowDialog.test.tsx \
  components/admin/BusinessHoursEditor.test.tsx \
  app/admin/bookings/page.test.tsx \
  app/admin/schedule/page.test.tsx
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint .

Test Files  5 passed (5)
Tests       19 passed (19)
```

Typecheck and ESLint completed with exit code 0 and no diagnostics. No API
contract, production data, configuration, dependency, or deployment was
changed in this fix round.
