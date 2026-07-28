# Task 9 Report — Party Request Lifecycle

Plan: `docs/superpowers/plans/2026-07-28-yezyy-flow-closure-remediation.md`

Branch: `codex/yezyy-flow-task9-party`

Base: `831fb00`

## Scope delivered

- Booking create now has a discriminated experience/party input contract.
- Party requests require an authoritative existing `partyPackageId`, an exact
  global party `timeSlotId`, name, phone, email, and an integer people count.
- The server loads the package and validates people against its current
  `minPeople`/`maxPeople`. Category-specific experience slots are rejected for
  party requests, and a caller-supplied date must match the Melbourne slot.
- Package name, price indicator, slot date, start/end time, timezone, and people
  are snapshotted in the booking transaction.
- The existing Task 7 advisory-lock idempotency flow is reused. One attempt key
  is retained across transport failure, identical concurrent requests create
  one booking, and a replay neither reserves capacity nor queues mail again.
- Customer acknowledgement and owner notification are enqueued in the same
  transaction as booking creation and capacity reservation.
- The existing Task 7 compare-and-set transition, actor history, status email,
  and cancellation release path is unchanged. PostgreSQL coverage now exercises
  party cancellation concurrently and proves one release, event, and email.
- The public English/Chinese party request form uses the selected package ID and
  a global-only slot calendar. It validates the current package people range,
  uses accessible labels/alerts/disclosure state, and explicitly says requests
  are manually confirmed with no online payment and payment in store.
- The Chinese admin list and detail screens distinguish `聚会预约` from
  `体验预约` and show the exact package, price, contact, slot, people, status,
  history, and delivery state.
- Task 3 durable booking limits remain on the shared booking route and were
  regression-tested against PostgreSQL.

## Catalogue decision

No party packages were inserted, seeded, imported, or published.

The catalogue audit withholds the proposed A$95 and A$145 packages because
owner-approved minimum/maximum people and current bilingual inclusions are
missing. The current zero-package public state remains the truthful call/email
contact state; it cannot display a fictional request success.

All names, price strings, and people limits used in automated tests are isolated
test fixtures only and are removed with their random test schemas.

## TDD evidence

### RED

- Six PostgreSQL party-create cases initially failed at the existing
  experience-only guard.
- The global party slot query initially returned a category-specific experience
  slot as well as the uncategorized slot.
- The public action initially had no party function, and the new form tests
  failed on missing required fields, authoritative IDs, and manual-payment copy.
- The party CTA test initially failed because no package-bound disclosure
  existed.
- The Chinese admin test initially showed exact booking data but no party label.

### GREEN

Focused public/API cycle:

```text
Party/action/time-slot web:
  Test Files  4 passed
  Tests       11 passed

Party/admin focused web:
  Test Files  5 passed
  Tests       15 passed

Party booking + time-slot PostgreSQL:
  Test Files  2 passed
  Tests       34 passed
```

## Final verification

```text
pnpm verify:
  workspace typechecks passed
  normal API: 22 passed files | 6 skipped
  normal API: 144 passed tests | 45 skipped
  full web ESLint passed
  database/API builds passed
  Next.js production build passed (22 static pages)

@yezz/web full suite:
  Test Files  23 passed
  Tests       93 passed

pnpm test:api:booking-db:
  Test Files  3 passed
  Tests       22 passed

pnpm test:rate-limits:db:
  Test Files  1 passed
  Tests       6 passed

git diff --check:
  passed
```

The guarded PostgreSQL commands used only random `yezyy_booking_test_*` and
rate-limit test schemas in the local `yezyy_test` database. The test helper
refuses production/equal database URLs and drops only its generated schemas.

No production access, deployment, external email, catalogue publication, push,
merge, or other external mutation occurred.
