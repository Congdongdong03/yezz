# Admin Mobile Booking Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Chinese admin booking queue fully usable on phones while preserving the desktop table and all current workflow behavior.

**Architecture:** Extract shared queue labels and formatters into a pure presenter module. Add a focused mobile booking card that consumes the existing booking DTO and delegates workflow actions to the page. The page renders cards below `md` and the existing table from `md` upward, with one shared mutation and dialog path.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, jsdom

## Global Constraints

- Ordinary DIY and party booking behavior must not change.
- Product and cart request capability remains disabled.
- The admin remains Chinese-first.
- All dates and times shown to staff use Australia/Melbourne semantics.
- Existing status-transition, idempotency, stale-state refresh, and email-delivery behavior remains authoritative.
- No new dependency is allowed.

---

### Task 1: Shared booking queue presenter

**Files:**
- Create: `apps/web/lib/admin/booking-queue.ts`
- Create: `apps/web/lib/admin/booking-queue.test.ts`
- Modify: `apps/web/app/admin/bookings/page.tsx`

**Interfaces:**
- Consumes: `Booking`, `BookingStatus`, `BookingWorkflowAction`, and `EMAIL_DELIVERY_LABELS`
- Produces: `BOOKING_STATUS_LABELS`, `BOOKING_ACTION_LABELS`, `formatBookingQueueDate(value)`, `formatBookingQueueAttendance(booking)`, `getBookingQueueOfferingName(booking)`, and `getBookingQueueDeliverySummary(booking)`

- [ ] **Step 1: Write failing pure presenter tests**

Cover an ordinary booking and a party booking. Assert Melbourne date formatting, bilingual offering fallback order, attendance summary, missing email fallback, and failed delivery count.

- [ ] **Step 2: Run the presenter test and verify the missing-module failure**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/admin/booking-queue.test.ts
```

Expected: FAIL because `booking-queue.ts` does not exist.

- [ ] **Step 3: Implement the pure presenter**

Move the existing status/action label maps and formatting logic out of the page. Keep output strings identical to the current desktop queue. Return delivery data as `{ label: string; failureLabel?: string }` so both card and table render the same facts without embedding React in the presenter.

- [ ] **Step 4: Update desktop queue imports and run focused tests**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/admin/booking-queue.test.ts app/admin/bookings/page.test.tsx
```

Expected: PASS with unchanged desktop behavior.

- [ ] **Step 5: Commit the presenter**

```bash
git add apps/web/lib/admin/booking-queue.ts apps/web/lib/admin/booking-queue.test.ts apps/web/app/admin/bookings/page.tsx
git commit -m "refactor(admin): share booking queue presentation"
```

### Task 2: Mobile booking work cards

**Files:**
- Create: `apps/web/components/admin/BookingQueueCard.tsx`
- Create: `apps/web/components/admin/BookingQueueCard.test.tsx`
- Modify: `apps/web/app/admin/bookings/page.tsx`
- Modify: `apps/web/app/admin/bookings/page.test.tsx`

**Interfaces:**
- Consumes: shared presenter exports from Task 1, `bookingActionsFor(kind, status)`, one `Booking`, `isUpdating: boolean`, and `onAction(action)`
- Produces: a phone-first card with customer-specific action labels and `/admin/bookings/:id` detail link

- [ ] **Step 1: Write the failing card tests**

Render an ordinary booking and assert the unread/kind/status labels, name, contact links, offering, slot, attendance, policy, delivery state, valid action buttons, and detail link. Rerender with `isUpdating=true` and assert all workflow buttons are disabled.

- [ ] **Step 2: Run the component test and verify the missing-component failure**

Run:

```bash
corepack pnpm --filter @yezz/web test -- components/admin/BookingQueueCard.test.tsx
```

Expected: FAIL because `BookingQueueCard.tsx` does not exist.

- [ ] **Step 3: Implement the mobile card**

Use a bordered white card with compact rose/sage badges, a two-column facts grid, real contact links, a clear delivery warning, and a two-column action grid. Keep the detail link full width. Do not create local workflow state.

- [ ] **Step 4: Render mobile cards and retain the desktop table**

In `AdminBookingsPage`, render the mobile collection as `space-y-3 md:hidden` and change the table container to `hidden ... md:block`. Both paths must call the existing `requestWorkflow(booking.id, action)` handler.

- [ ] **Step 5: Extend the page test**

Assert that the mobile queue and desktop table are both in the DOM, have their responsive classes, and that clicking a card action opens the existing `BookingWorkflowDialog` for the same booking.

- [ ] **Step 6: Run focused web tests**

Run:

```bash
corepack pnpm --filter @yezz/web test -- components/admin/BookingQueueCard.test.tsx app/admin/bookings/page.test.tsx components/admin/BookingWorkflowDialog.test.tsx components/admin/AdminShell.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the responsive queue**

```bash
git add apps/web/components/admin/BookingQueueCard.tsx apps/web/components/admin/BookingQueueCard.test.tsx apps/web/app/admin/bookings/page.tsx apps/web/app/admin/bookings/page.test.tsx
git commit -m "feat(admin): add mobile booking work queue"
```

### Task 3: Release verification and production proof

**Files:**
- Modify only if verification finds a requirement regression.

**Interfaces:**
- Consumes: Tasks 1–2
- Produces: verified release commit with mobile cards, unchanged desktop workflow, and production evidence

- [ ] **Step 1: Run full release verification**

Run:

```bash
corepack pnpm verify:release
```

Expected: all typecheck, lint, unit, PostgreSQL integration, build, and browser closure checks pass. Existing lint warnings may remain only if their count and files are unchanged.

- [ ] **Step 2: Review the release diff**

Run:

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: only the design/plan, shared presenter, mobile card, page integration, and their tests differ.

- [ ] **Step 3: Merge and deploy through the established main-branch workflow**

Fast-forward only after verification. Push `main` so the established web deployment runs. No API deployment is needed because the DTO and endpoints are unchanged.

- [ ] **Step 4: Verify live desktop and phone views**

Open `/admin/bookings` in the authenticated admin session. At phone width confirm cards are visible without horizontal page scrolling; at desktop width confirm the table remains visible. Open a valid workflow dialog from each presentation but do not submit a production status transition during this read-only visual proof.

- [ ] **Step 5: Verify public capability boundaries**

Confirm the live settings remain `experience=true`, `party=true`, and `product=false`, and confirm the public booking and party pages still return successfully.
