# YezYY Live DIY Booking and Party Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the deployed YezYY application into a closed-loop ordinary DIY, waitlist, and party operating system while keeping every public request capability disabled until the owner explicitly opens it.

**Architecture:** Keep the existing Next.js BFF, Fastify API, PostgreSQL/Drizzle database, idempotent request creation, compare-and-set status history, durable email outbox, and Chinese admin. Replace fixed-slot reservation for live DIY with server-authoritative Melbourne-local interval availability, add focused ordinary/party/waitlist workflows, and combine environment hard gates with admin-controlled database switches.

**Tech Stack:** Next.js 16, React 19, next-intl 4, React Hook Form, Zod 4, Fastify 5, PostgreSQL, Drizzle ORM 0.44, Resend, TypeScript 5.9, Vitest 4, Playwright 1.61, Mailpit, pnpm 10.

## Global Constraints

- Public brand casing is exactly `YezYY`.
- Canonical public origin is exactly `https://yezyy.com`.
- Public address is exactly `G082/235 Springvale Rd, Glen Waverley VIC 3150`.
- Public phone is exactly `0430 787 712`.
- Public Xiaohongshu ID is exactly `95848743904`.
- Currency is AUD and there is no online payment.
- All operational dates and times use `Australia/Melbourne`.
- Customers may request the current Melbourne date through seven calendar days ahead.
- Every requested start is at least two hours in the future and aligned to a 30-minute boundary.
- Every ordinary activity finishes by public closing time.
- Ordinary DIY physical occupancy, including non-participating adults, never exceeds eight.
- Pending ordinary requests and waitlist requests do not reserve capacity.
- Staff confirmation performs one transactional overlap check before reserving ordinary capacity.
- Ordinary DIY minimum age is five; children aged five through eight require an accompanying adult.
- A party has four to eight participants plus one or two accompanying parents.
- The party birthday child must be at least five years old.
- New ordinary DIY and party submissions accept policy version `2026-07-30`; historical booking rows retain their original accepted version for audit.
- Every party participant chooses at least one DIY project and has a $45 minimum DIY spend.
- Party packages are $95 for 1.5 guest hours and $145 for 2.5 guest hours.
- Party setup and cleanup default to 30 minutes each and may fall outside public hours only after staff approval.
- A party hold begins only at `awaiting_in_store_payment` and expires at the staff-selected payment deadline.
- There is no online payment; ordinary customers pay at arrival and party customers pay the venue fee/deposit in store before the event.
- Party cancellation at least 48 hours before guest start is fully refundable; later cancellation is non-refundable.
- Ordinary cancellation or rescheduling at least two hours before start is free; later requests are staff discretion.
- More than 20 minutes late means the original ordinary-DIY time is not guaranteed.
- Public pages and customer emails are English or Simplified Chinese according to the original request locale.
- The admin remains Simplified Chinese.
- Email sender is `YezYY Bookings <bookings@yezyy.com>` and Reply-To is `congdongdong03@gmail.com`.
- Product sales and product requests are not changed and remain disabled.
- Do not publish fictional projects, fake customer work, stock work, or AI-generated work as real YezYY photography.
- Do not permanently advertise the photographed temporary melty-bead discount.
- `REQUEST_FLOW_EXPERIENCE_ENABLED`, `REQUEST_FLOW_PARTY_ENABLED`, and `REQUEST_FLOW_PRODUCT_ENABLED` remain `false` in the initial production deployment.
- Production customer data must never be used by automated tests.

## File and Dependency Map

### Database foundation

- `packages/db/migrations/0003_yezyy_live_booking_operations.sql` — forward migration for live booking states, attendance, line items, schedules, party operations, customer tokens, charges, and password setup.
- `packages/db/src/schema/index.ts` — Drizzle declarations.
- `packages/db/src/schema/live-booking.type-test.ts` — compile-time schema contract.
- `packages/db/src/migrations/live-booking.migration.test.ts` — empty and legacy migration verification.

### API domain units

- `apps/api/src/lib/booking-policy.ts` — pure Melbourne window, lead-time, duration, attendance, and supervision rules.
- `apps/api/src/lib/booking-workflow.ts` — booking status types and allowed transitions.
- `apps/api/src/repositories/studio-schedule.repository.ts` — weekly hours, dated special hours, and partial closures.
- `apps/api/src/repositories/booking-availability.repository.ts` — interval locks and overlap reads.
- `apps/api/src/services/availability.service.ts` — generated public starts and staff conflict checks.
- `apps/api/src/services/bookings.service.ts` — ordinary and waitlist request creation.
- `apps/api/src/services/admin/bookings.admin.service.ts` — transactional staff transitions.
- `apps/api/src/services/party-workflow.service.ts` — time proposals, payment holds, payment records, expiry, refunds, and charges.
- `apps/api/src/services/customer-actions.service.ts` — scoped customer token resolution and customer requests.
- `apps/api/src/services/booking-maintenance.service.ts` — reminders and expired party holds.
- `apps/api/src/lib/email-outbox-payload.ts` and `apps/api/src/lib/email.ts` — bilingual operational messages.

### Public API and web

- `apps/api/src/routes/v1/availability.routes.ts` — ordinary and party candidate starts.
- `apps/api/src/routes/v1/bookings.routes.ts` — ordinary, waitlist, and party creation.
- `apps/api/src/routes/v1/customer-bookings.routes.ts` — scoped customer actions.
- `apps/web/components/book/OrdinaryBookingForm.tsx` — ordinary booking workflow.
- `apps/web/components/book/ProjectQuantityPicker.tsx` — mixed project quantities and longest duration.
- `apps/web/components/book/AttendanceFields.tsx` — participant, child, and accompanying-adult totals.
- `apps/web/components/book/PolicyConsent.tsx` — versioned policy acceptance.
- `apps/web/components/parties/PartyBookingForm.tsx` — party request details.
- `apps/web/app/[locale]/manage-booking/[token]/page.tsx` — customer time acceptance, cancellation, and rescheduling.

### Chinese admin

- `apps/api/src/routes/v1/admin/bookings.routes.ts` — workflow actions and calendar read model.
- `apps/api/src/routes/v1/admin/settings.routes.ts` — structured schedule and database capability switches.
- `apps/web/app/admin/schedule/page.tsx` — seven-day operational calendar.
- `apps/web/app/admin/bookings/page.tsx` and `apps/web/app/admin/bookings/[id]/page.tsx` — queue and detail operations.
- `apps/web/components/admin/BookingWorkflowDialog.tsx` — status-specific action form.
- `apps/web/components/admin/BusinessHoursEditor.tsx` — weekly and dated schedule controls.
- `apps/web/app/admin/settings/page.tsx` — schedule and database switch integration.

### Verification and rollout

- `apps/web/e2e/live-ordinary-booking.spec.ts`
- `apps/web/e2e/live-waitlist.spec.ts`
- `apps/web/e2e/live-party-booking.spec.ts`
- `apps/web/e2e/live-customer-actions.spec.ts`
- `docs/production-config-checklist.md`
- `.env.example`

---

### Task 1: Add the Live Booking Database Contract

**Files:**
- Create: `packages/db/migrations/0003_yezyy_live_booking_operations.sql`
- Create: `packages/db/src/schema/live-booking.type-test.ts`
- Create: `packages/db/src/migrations/live-booking.migration.test.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/migrations/meta/_journal.json`
- Create or regenerate: `packages/db/migrations/meta/0003_snapshot.json`

**Interfaces:**
- Produces: `BookingStatus`, `BookingChargeType`, and `CustomerActionScope` schema types.
- Produces: `bookingItems`, `bookingPartyDetails`, `bookingCharges`, `customerActionTokens`, `studioWeeklyHours`, `studioSpecialHours`, `studioClosures`, and `passwordSetupTokens`.
- Extends: `bookings`, `diyProjects`, `partyPackages`, `requestStatusEvents`, `siteSettings`, and `users`.
- Produces: the exact `owner | admin | staff` user-role contract and session-version invalidation field.
- Preserves: existing `cart_orders` and `order_status`.

- [ ] **Step 1: Write the failing compile-time schema contract**

```ts
import {
  bookingCharges,
  bookingItems,
  bookingPartyDetails,
  bookings,
  customerActionTokens,
  diyProjects,
  partyPackages,
  passwordSetupTokens,
  siteSettings,
  studioClosures,
  studioSpecialHours,
  studioWeeklyHours,
  users,
} from "./index.js";

void bookings.participantCount;
void bookings.youngChildCount;
void bookings.accompanyingAdultCount;
void bookings.attendanceCount;
void bookings.durationMinutes;
void bookings.policyVersion;
void bookingItems.durationMinutesSnapshot;
void bookingPartyDetails.paymentDeadline;
void bookingCharges.amountCents;
void customerActionTokens.tokenDigest;
void studioWeeklyHours.weekday;
void studioSpecialHours.date;
void studioClosures.startTime;
void passwordSetupTokens.userId;
void users.sessionVersion;
void diyProjects.durationMinutes;
void partyPackages.guestDurationMinutes;
void siteSettings.experienceRequestsEnabled;
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/db typecheck
```

Expected: TypeScript errors for the undeclared columns and tables.

- [ ] **Step 3: Declare exact status and operational types**

Keep `orderStatusEnum` for product orders. Change only `bookings.status` to a checked `varchar(32)` typed as:

```ts
export type BookingStatus =
  | "pending_review"
  | "confirmed"
  | "waitlisted"
  | "rejected"
  | "time_proposed"
  | "awaiting_in_store_payment"
  | "confirmed_paid"
  | "payment_expired"
  | "reschedule_requested"
  | "cancellation_requested"
  | "cancelled"
  | "refunded"
  | "no_show"
  | "completed";

export type BookingChargeType =
  | "venue_fee"
  | "cake_cutting"
  | "cleaning"
  | "overtime"
  | "refund";

export type CustomerActionScope =
  | "accept_time"
  | "request_cancellation"
  | "request_reschedule";
```

Add the following exact booking attendance fields:

```ts
participantCount: integer("participant_count"),
youngChildCount: integer("young_child_count"),
accompanyingAdultCount: integer("accompanying_adult_count"),
attendanceCount: integer("attendance_count"),
durationMinutes: integer("duration_minutes"),
policyVersion: varchar("policy_version", { length: 32 }),
policyAcceptedAt: timestamp("policy_accepted_at", { withTimezone: true }),
```

Make `requestStatusEvents.actorUserId` nullable and add:

```ts
actorKind: varchar("actor_kind", { length: 16 })
  .$type<"staff" | "customer" | "system">()
  .notNull()
  .default("staff"),
```

- [ ] **Step 4: Add focused related tables**

Use these exact ownership rules:

```ts
export const bookingItems = pgTable("booking_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => diyProjects.id, { onDelete: "restrict" }),
  projectNameSnapshot: jsonb("project_name_snapshot").$type<LocalizedString>(),
  unitPriceCentsSnapshot: integer("unit_price_cents_snapshot"),
  durationMinutesSnapshot: integer("duration_minutes_snapshot").notNull(),
  quantity: integer("quantity").notNull(),
  decideInStore: boolean("decide_in_store").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customerActionTokens = pgTable("customer_action_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
  scopes: text("scopes").array().$type<CustomerActionScope[]>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Define the user role and forced-session-invalidation contract in the same foundation task:

```ts
export type UserRole = "owner" | "admin" | "staff";

role: varchar("role", { length: 16 }).$type<UserRole>().notNull().default("staff"),
sessionVersion: integer("session_version").notNull().default(0),
```

Every admin access token later carries `sessionVersion`; authenticated admin requests compare it with the current database value.

Use this exact operational shape for the remaining focused tables:

```ts
export const bookingPartyDetails = pgTable("booking_party_details", {
  bookingId: uuid("booking_id").primaryKey()
    .references(() => bookings.id, { onDelete: "cascade" }),
  birthdayChildName: varchar("birthday_child_name", { length: 255 }).notNull(),
  birthdayChildAge: integer("birthday_child_age").notNull(),
  participantCount: integer("participant_count").notNull(),
  parentCount: integer("parent_count").notNull(),
  desiredDate: date("desired_date").notNull(),
  desiredStartTime: varchar("desired_start_time", { length: 5 }).notNull(),
  byoCake: boolean("byo_cake").notNull().default(false),
  byoDrinks: boolean("byo_drinks").notNull().default(false),
  byoFood: boolean("byo_food").notNull().default(false),
  byoSnacks: boolean("byo_snacks").notNull().default(false),
  cakeCuttingRequested: boolean("cake_cutting_requested").notNull().default(false),
  specialRequirements: text("special_requirements"),
  finalDate: date("final_date"),
  finalSetupStart: varchar("final_setup_start", { length: 5 }),
  finalGuestStart: varchar("final_guest_start", { length: 5 }),
  finalGuestEnd: varchar("final_guest_end", { length: 5 }),
  finalCleanupEnd: varchar("final_cleanup_end", { length: 5 }),
  venueFeeCents: integer("venue_fee_cents").notNull(),
  minSpendPerPersonCents: integer("min_spend_per_person_cents").notNull(),
  paymentDeadline: timestamp("payment_deadline", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidAmountCents: integer("paid_amount_cents"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
});

export const bookingCharges = pgTable("booking_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 24 }).$type<BookingChargeType>().notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note"),
  recordedByUserId: uuid("recorded_by_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordSetupTokens = pgTable("password_setup_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 5: Add structured schedules and hard-gated database switches**

Add:

```ts
export const studioWeeklyHours = pgTable("studio_weekly_hours", {
  weekday: integer("weekday").primaryKey(),
  opensAt: varchar("opens_at", { length: 5 }).notNull(),
  closesAt: varchar("closes_at", { length: 5 }).notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
});

export const studioSpecialHours = pgTable("studio_special_hours", {
  date: date("date").primaryKey(),
  opensAt: varchar("opens_at", { length: 5 }),
  closesAt: varchar("closes_at", { length: 5 }),
  isClosed: boolean("is_closed").notNull().default(false),
  note: text("note"),
});

export const studioClosures = pgTable("studio_closures", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  startTime: varchar("start_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  note: text("note"),
});
```

Add three booleans to `site_settings`, all defaulting to `false`:

```ts
experienceRequestsEnabled: boolean("experience_requests_enabled").notNull().default(false),
partyRequestsEnabled: boolean("party_requests_enabled").notNull().default(false),
productRequestsEnabled: boolean("product_requests_enabled").notNull().default(false),
```

Public capabilities are later computed as `environmentGate && databaseSwitch`.

- [ ] **Step 6: Write and test the migration**

The migration must:

```sql
ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;
ALTER TABLE bookings ALTER COLUMN status TYPE varchar(32) USING status::text;
UPDATE bookings SET status = CASE status
  WHEN 'new' THEN 'pending_review'
  WHEN 'contacted' THEN 'pending_review'
  WHEN 'confirmed' THEN 'confirmed'
  WHEN 'cancelled' THEN 'cancelled'
  ELSE status
END;
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'pending_review';
```

It must also map the existing `admin | staff` roles without changing them, allow the new `owner` value, add `users.session_version NOT NULL DEFAULT 0`, and preserve every existing user session at version zero.

It must keep historical `confirmed` parties unchanged rather than inventing a payment. New party transitions use `confirmed_paid`.

Seed these exact seven weekly-hours rows with `INSERT ... ON CONFLICT DO NOTHING`:

| Day | Opens | Closes |
| --- | --- | --- |
| Monday | `09:30` | `17:00` |
| Tuesday | `09:30` | `17:00` |
| Wednesday | `09:30` | `17:00` |
| Thursday | `09:30` | `20:30` |
| Friday | `09:30` | `20:30` |
| Saturday | `09:30` | `17:30` |
| Sunday | `10:00` | `17:00` |

Add checks for non-negative cents, positive quantities/durations, weekday `0..6`, `HH:MM` formatting, whole-day closure null pairs, ordinary attendance `1..8`, party participants `4..8`, and party parents `1..2`.

Run:

```bash
corepack pnpm --filter @yezz/db build
corepack pnpm --filter @yezz/db typecheck
corepack pnpm --filter @yezz/db test -- src/migrations/live-booking.migration.test.ts
```

Expected: empty-schema and legacy `0002` fixture migrations both pass; legacy confirmed parties remain distinguishable and no payment is fabricated.

- [ ] **Step 7: Commit**

```bash
git add packages/db
git commit -m "feat: add live booking operations schema"
```

### Task 2: Implement Melbourne Booking Policy and Generated Availability

**Files:**
- Create: `apps/api/src/lib/booking-policy.ts`
- Create: `apps/api/src/lib/booking-policy.test.ts`
- Create: `apps/api/src/repositories/studio-schedule.repository.ts`
- Create: `apps/api/src/repositories/booking-availability.repository.ts`
- Create: `apps/api/src/repositories/booking-availability.repository.test.ts`
- Create: `apps/api/src/services/availability.service.ts`
- Create: `apps/api/src/services/availability.service.test.ts`
- Create: `apps/api/src/routes/v1/availability.routes.ts`
- Create: `apps/api/src/routes/v1/availability.routes.test.ts`
- Modify: `apps/api/src/routes/v1/index.ts`
- Modify: `apps/api/src/plugins/services.ts`
- Modify: `apps/api/src/lib/slot-policy.ts`
- Modify: `apps/api/src/lib/slot-policy.test.ts`

**Interfaces:**
- Produces: `getMelbourneClock(now: Date): MelbourneClock`.
- Produces: `validateBookingWindow(input, clock, hours): void`.
- Produces: `generateThirtyMinuteStarts(input): string[]`.
- Produces: `AvailabilityService.listOrdinary(input): Promise<AvailabilitySlot[]>`.
- Produces: `AvailabilityService.listPartyCandidates(input): Promise<PartyCandidateSlot[]>`.
- Consumes: weekly hours, special hours, closures, confirmed ordinary intervals, and active/confirmed party intervals.

- [ ] **Step 1: Write failing pure policy tests**

```ts
it("allows only the current Melbourne date through seven calendar days", () => {
  const clock = { date: "2026-07-29", minuteOfDay: 10 * 60 };
  expect(() => validateBookingWindow({
    date: "2026-08-05",
    startTime: "12:00",
    durationMinutes: 60,
  }, clock, { opensAt: "09:30", closesAt: "17:00" })).not.toThrow();
  expect(() => validateBookingWindow({
    date: "2026-08-06",
    startTime: "12:00",
    durationMinutes: 60,
  }, clock, { opensAt: "09:30", closesAt: "17:00" }))
    .toThrowError(/seven calendar days/);
});

it("requires two hours and completion by close", () => {
  const clock = { date: "2026-07-29", minuteOfDay: 14 * 60 };
  expect(() => validateBookingWindow({
    date: "2026-07-29",
    startTime: "15:30",
    durationMinutes: 60,
  }, clock, { opensAt: "09:30", closesAt: "17:00" }))
    .toThrowError(/two hours/);
  expect(() => validateBookingWindow({
    date: "2026-07-29",
    startTime: "16:30",
    durationMinutes: 60,
  }, { ...clock, minuteOfDay: 9 * 60 }, {
    opensAt: "09:30",
    closesAt: "17:00",
  })).toThrowError(/closing/);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/lib/booking-policy.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the pure contract**

```ts
export const BOOKING_HORIZON_CALENDAR_DAYS = 7;
export const MINIMUM_LEAD_MINUTES = 120;
export const START_INCREMENT_MINUTES = 30;
export const ORDINARY_CAPACITY = 8;

export type MelbourneClock = {
  date: string;
  minuteOfDay: number;
};

export type BookingWindowInput = {
  date: string;
  startTime: string;
  durationMinutes: 30 | 60 | 90 | 150;
};

export type OperatingHours = {
  opensAt: string;
  closesAt: string;
};
```

Use `Intl.DateTimeFormat(..., { timeZone: "Australia/Melbourne", hourCycle: "h23" })` to derive the current local date and minute. Compare calendar ordinals, not 24-hour millisecond differences. Require starts divisible by 30 and `start + duration <= close`.

- [ ] **Step 4: Add schedule and overlap repositories**

`studio-schedule.repository.ts` returns one resolved schedule:

```ts
type ResolvedStudioDay = {
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  closures: Array<{ startTime: string | null; endTime: string | null }>;
};
```

`booking-availability.repository.ts` exposes:

```ts
type LocalInterval = { date: string; startTime: string; endTime: string };

sumConfirmedAttendance(
  interval: LocalInterval,
  tx?: Db,
): Promise<number>;

hasExclusivePartyOverlap(
  interval: LocalInterval,
  tx?: Db,
): Promise<boolean>;

lockOperationalDate(date: string, tx: Db): Promise<void>;
```

Use half-open overlap SQL:

```sql
slot_date = $date
AND slot_start_time < $candidate_end
AND slot_end_time > $candidate_start
```

Ordinary occupancy includes only `confirmed`. Party conflicts include `awaiting_in_store_payment`, `confirmed_paid`, and legacy `confirmed`.

- [ ] **Step 5: Implement generated availability**

```ts
export type AvailabilitySlot = {
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "waitlist";
  remaining: number;
};
```

Generate 30-minute starts from resolved hours, exclude partial closures, enforce the requested 30- or 60-minute duration, subtract overlapping confirmed attendance, and change the slot to `waitlist` when remaining attendance is below the requested attendance. Party candidates validate the guest-use duration only and remain `request_only: true`.

- [ ] **Step 6: Add read routes**

Register:

```text
GET /api/v1/availability/ordinary?date=YYYY-MM-DD&durationMinutes=60&attendance=3
GET /api/v1/availability/party?date=YYYY-MM-DD&guestDurationMinutes=90
```

Return same-locale validation codes; the web maps codes to copy.

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/lib/booking-policy.test.ts \
  src/repositories/booking-availability.repository.test.ts \
  src/services/availability.service.test.ts \
  src/routes/v1/availability.routes.test.ts
corepack pnpm --filter @yezz/api typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib apps/api/src/repositories apps/api/src/services apps/api/src/routes apps/api/src/plugins
git commit -m "feat: add Melbourne interval availability"
```

### Task 3: Add the Approved DIY and Party Service Catalogue

**Files:**
- Create: `packages/db/src/live-booking-catalogue.ts`
- Create: `packages/db/src/live-booking-catalogue.test.ts`
- Create: `packages/db/src/seed-live-booking-catalogue.ts`
- Modify: `packages/db/package.json`
- Modify: `apps/api/src/services/projects.service.ts`
- Modify: `apps/api/src/services/projects.service.test.ts`
- Modify: `apps/api/src/services/parties.service.ts`
- Modify: `apps/api/src/services/parties.service.test.ts`
- Modify: `apps/web/lib/api/types.ts`
- Modify: `apps/web/lib/api/mappers.ts`
- Modify: `apps/web/lib/api/mappers.test.ts`

**Interfaces:**
- Produces: authoritative `durationMinutes`, `bookable`, and cents-based project pricing.
- Produces: two authoritative party packages with guest/setup/cleanup duration and venue-fee snapshots.
- Consumes: the Task 1 schema.

- [ ] **Step 1: Write failing catalogue contract tests**

```ts
it("contains only approved live services", () => {
  const slugs = LIVE_DIY_PROJECTS.map((project) => project.slug);
  expect(slugs).toContain("melty-bead-craft");
  expect(slugs).toContain("paint-clay-figurine-mini");
  expect(slugs).toContain("beading");
  expect(LIVE_DIY_PROJECTS.find((p) => p.slug === "beading")).toMatchObject({
    priceMinCents: 4300,
    durationMinutes: 30,
  });
});

it("does not encode the temporary melty-bead discount", () => {
  expect(JSON.stringify(LIVE_DIY_PROJECTS)).not.toMatch(/50%|half price/i);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/db test -- src/live-booking-catalogue.test.ts
```

- [ ] **Step 3: Define immutable approved data**

```ts
export type LiveProjectSeed = {
  categorySlug: "air-dry-cream-piping" | "melty-beads" | "paint-clay" | "beading";
  slug: string;
  name: { en: string; zh: string };
  priceMinCents: number;
  priceMaxCents: number;
  durationMinutes: 30 | 60;
  variantSelectedInStore: boolean;
};

export const LIVE_PARTY_PACKAGES = [
  {
    slug: "party-90",
    guestDurationMinutes: 90,
    setupMinutes: 30,
    cleanupMinutes: 30,
    venueFeeCents: 9500,
    minPeople: 4,
    maxPeople: 8,
    minSpendPerPersonCents: 4500,
  },
  {
    slug: "party-150",
    guestDurationMinutes: 150,
    setupMinutes: 30,
    cleanupMinutes: 30,
    venueFeeCents: 14500,
    minPeople: 4,
    maxPeople: 8,
    minSpendPerPersonCents: 4500,
  },
] as const;
```

Encode this complete approved catalogue; all amounts are AUD cents:

| Slug | English label | Price min | Price max | Duration | In-store variant |
| --- | --- | ---: | ---: | ---: | --- |
| `air-dry-two-hair-clips` | Two hair clips | 1800 | 1800 | 30 | no |
| `air-dry-fridge-magnet` | Fridge magnet | 1800 | 1800 | 30 | no |
| `air-dry-mini-drawers` | Mini drawers | 3200 | 3200 | 30 | no |
| `air-dry-hair-claw` | Hair claw | 3200 | 3200 | 30 | no |
| `air-dry-car-decoration-stand` | Car decoration stand | 3800 | 3800 | 30 | no |
| `air-dry-medium-storage` | Medium storage box/drawers | 6500 | 6500 | 60 | no |
| `air-dry-large-storage` | Large storage box/drawers | 9800 | 9800 | 60 | no |
| `air-dry-glass-dome` | Glass dome | 9800 | 9800 | 60 | no |
| `air-dry-extra-large-drawer` | Extra-large drawer | 19700 | 19700 | 60 | no |
| `air-dry-pen-holder` | Pen holder, one face | 5000 | 5000 | 60 | no |
| `air-dry-extra-face` | Extra face | 3300 | 3300 | 60 | no |
| `air-dry-mug` | Mug | 6500 | 6500 | 60 | no |
| `air-dry-lamp` | Lamp | 4300 | 4300 | 60 | yes |
| `air-dry-mirror` | Mirror | 8700 | 8700 | 60 | no |
| `air-dry-notebook` | Notebook | 8700 | 8700 | 60 | no |
| `air-dry-pencil-case` | Pencil case | 6500 | 6500 | 60 | no |
| `air-dry-phone-case` | Phone case | 6600 | 6600 | 60 | yes |
| `air-dry-phone-stand` | Phone stand | 7600 | 7600 | 60 | no |
| `air-dry-phone-socket` | Phone socket | 3200 | 3200 | 60 | no |
| `air-dry-small-bag` | Small bag to decorate | 6500 | 6500 | 60 | no |
| `air-dry-large-bag` | Large bag to decorate | 10900 | 10900 | 60 | no |
| `air-dry-water-bottle` | Water bottle | 8800 | 8800 | 60 | no |
| `melty-bead-craft` | Melty bead craft | 4950 | 4950 | 60 | no |
| `paint-clay-figurine-mini` | Paint clay figurine — Mini | 1980 | 1980 | 60 | no |
| `paint-clay-figurine-small` | Paint clay figurine — Small | 2750 | 2750 | 60 | no |
| `paint-clay-figurine-medium` | Paint clay figurine — Medium | 3850 | 3850 | 60 | no |
| `paint-clay-figurine-large` | Paint clay figurine — Large | 5400 | 5400 | 60 | no |
| `beading` | Beading — from $43 | 4300 | 4300 | 30 | yes |

Also define `melty-bead-craft.extraTimeMinutes = 30` and `extraTimePriceCents = 1650`. The public site shows both values without treating them as an initial booking option. `Decide in store` is a synthetic form option, costs no snapshot amount, reserves 60 minutes, and is never inserted as a DIY project row. Add accurate Simplified Chinese labels for every row. Do not add cover images.

- [ ] **Step 4: Add an idempotent manual seed command**

Add:

```json
{
  "scripts": {
    "seed:live-booking": "tsx src/seed-live-booking-catalogue.ts"
  }
}
```

The script upserts only by stable slugs, does not delete other rows, leaves capability switches false, and refuses to run when `CONFIRM_LIVE_CATALOGUE_SEED` is not exactly `YezYY`.

- [ ] **Step 5: Expose operational fields**

Project DTOs return:

```ts
{
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: "AUD";
  durationMinutes: number | null;
  bookable: boolean;
  variantSelectedInStore: boolean;
}
```

Party DTOs return `guestDurationMinutes`, `setupMinutes`, `cleanupMinutes`, `venueFeeCents`, `minSpendPerPersonCents`, `minParents`, and `maxParents`.

Run:

```bash
corepack pnpm --filter @yezz/db test -- src/live-booking-catalogue.test.ts
corepack pnpm --filter @yezz/api test -- src/services/projects.service.test.ts src/services/parties.service.test.ts
corepack pnpm --filter @yezz/web test -- lib/api/mappers.test.ts
corepack pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/db apps/api/src/services apps/web/lib/api
git commit -m "feat: define approved YezYY booking catalogue"
```

### Task 4: Implement Ordinary DIY Request and Confirmation

**Files:**
- Create: `apps/api/src/lib/booking-workflow.ts`
- Create: `apps/api/src/lib/booking-workflow.test.ts`
- Modify: `apps/api/src/repositories/bookings.repository.ts`
- Modify: `apps/api/src/repositories/request-capacity.repository.ts`
- Modify: `apps/api/src/services/bookings.service.ts`
- Modify: `apps/api/src/services/bookings.service.test.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.test.ts`
- Modify: `apps/api/src/services/request-transition.service.ts`
- Modify: `apps/api/src/services/request-transition.service.test.ts`
- Modify: `apps/api/src/routes/v1/bookings.routes.ts`
- Modify: `apps/api/src/routes/v1/bookings.routes.test.ts`
- Modify: `apps/api/src/routes/v1/admin/bookings.routes.ts`

**Interfaces:**
- Consumes: Task 2 booking policy and availability repositories.
- Consumes: Task 3 project duration and price records.
- Produces: `createOrdinaryRequest(input, idempotencyKey)`.
- Produces: transactional `transitionOrdinary(input)`.
- Preserves: the legacy fixed-slot path for historical/product compatibility, but live ordinary requests do not mutate `time_slots.booked_count`.

- [ ] **Step 1: Write failing creation tests**

```ts
it("creates a pending request without reserving capacity", async () => {
  const result = await service.create({
    kind: "experience",
    name: "Customer",
    email: "customer@example.com",
    phone: "0430000000",
    date: "2026-07-30",
    startTime: "10:00",
    participantCount: 2,
    youngChildCount: 1,
    accompanyingAdultCount: 1,
    items: [{ projectId: project.id, quantity: 2 }],
    locale: "en",
    policyVersion: "2026-07-30",
    policyAccepted: true,
  }, IDEMPOTENCY_KEY);

  expect(result.status).toBe("pending_review");
  expect(await confirmedAttendance("2026-07-30", "10:00", "11:00")).toBe(0);
});
```

Add failures for:

- total physical attendance above eight;
- a five-to-eight-year-old count without an accompanying adult;
- project quantity not equal to participant count;
- start less than two hours away;
- end after close;
- missing policy acceptance;
- unknown or non-bookable project;
- reusing an idempotency key with a different body.

- [ ] **Step 2: Verify RED**

Run:

```bash
YEZYY_RUN_DB_BOOKING_TESTS=1 corepack pnpm --filter @yezz/api test -- \
  src/services/bookings.service.test.ts
```

- [ ] **Step 3: Define exact public input**

```ts
export type OrdinaryBookingItemInput =
  | { projectId: string; quantity: number; decideInStore?: false }
  | { projectId?: never; quantity: number; decideInStore: true };

export type OrdinaryBookingCreateInput = {
  kind: "experience";
  mode: "booking" | "waitlist";
  name: string;
  phone: string;
  email: string;
  date: string;
  startTime: string;
  participantCount: number;
  youngChildCount: number;
  accompanyingAdultCount: number;
  items: OrdinaryBookingItemInput[];
  message?: string;
  locale: "en" | "zh";
  policyVersion: "2026-07-30";
  policyAccepted: true;
};
```

Compute:

```ts
attendanceCount = participantCount + accompanyingAdultCount;
durationMinutes = Math.max(...itemDurationSnapshots);
endTime = addMinutes(startTime, durationMinutes);
```

Persist item names, cents, and durations as snapshots in the same creation transaction. `mode: "waitlist"` starts at `waitlisted`; otherwise it starts at `pending_review`.

- [ ] **Step 4: Define allowed ordinary transitions**

```ts
export const ORDINARY_TRANSITIONS = {
  pending_review: ["confirmed", "waitlisted", "rejected", "cancelled"],
  waitlisted: ["confirmed", "rejected", "cancelled"],
  confirmed: [
    "reschedule_requested",
    "cancellation_requested",
    "cancelled",
    "no_show",
    "completed",
  ],
  reschedule_requested: ["confirmed", "cancelled"],
  cancellation_requested: ["confirmed", "cancelled"],
  rejected: [],
  cancelled: [],
  no_show: [],
  completed: [],
} as const;
```

Legacy `confirmed` remains supported. Party-only states are rejected by the ordinary service.

- [ ] **Step 5: Confirm transactionally**

In one transaction:

```ts
await availabilityRepo.lockOperationalDate(existing.slotDate, tx);
const occupied = await availabilityRepo.sumConfirmedAttendance(interval, tx);
const hasParty = await availabilityRepo.hasExclusivePartyOverlap(interval, tx);
if (hasParty || occupied + existing.attendanceCount > 8) {
  throw new AppError(409, "CAPACITY_CONFLICT", "The requested interval is full");
}
await bookingsRepo.compareAndSetStatus(
  existing.id,
  input.expectedStatus,
  "confirmed",
  tx,
);
await statusEventsRepo.createBooking(event, tx);
await emailOutboxRepo.enqueue(confirmation, tx);
```

Rescheduling locks both old and new dates in sorted order, validates the new interval, and updates date/start/end/duration before restoring `confirmed`.

- [ ] **Step 6: Update routes and verification**

`POST /api/v1/bookings` accepts the new ordinary body and continues to reject requests when the environment hard gate or database switch is false. The admin status endpoint accepts `expectedStatus`, `operationId`, `toStatus`, optional new date/start, and note.

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/lib/booking-workflow.test.ts \
  src/services/bookings.service.test.ts \
  src/services/admin/bookings.admin.service.test.ts \
  src/services/request-transition.service.test.ts \
  src/routes/v1/bookings.routes.test.ts
corepack pnpm --filter @yezz/api typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat: close ordinary DIY booking workflow"
```

### Task 5: Implement Waitlist and Scoped Customer Actions

**Files:**
- Create: `apps/api/src/repositories/customer-action-tokens.repository.ts`
- Create: `apps/api/src/repositories/customer-action-tokens.repository.test.ts`
- Create: `apps/api/src/services/customer-actions.service.ts`
- Create: `apps/api/src/services/customer-actions.service.test.ts`
- Create: `apps/api/src/routes/v1/customer-bookings.routes.ts`
- Create: `apps/api/src/routes/v1/customer-bookings.routes.test.ts`
- Modify: `apps/api/src/routes/v1/index.ts`
- Modify: `apps/api/src/plugins/services.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.test.ts`

**Interfaces:**
- Produces: `issueCustomerActionToken(input): Promise<string>`.
- Produces: `resolveCustomerActionToken(rawToken, scope): Promise<CustomerBookingView>`.
- Produces: customer actions `request_cancellation` and `request_reschedule`.
- Prepares: `accept_time` scope resolution; Task 6 adds the party transition and public route.
- Consumes: Task 4 transitions and Task 2 availability.

- [ ] **Step 1: Write failing token security tests**

```ts
it("stores only a digest and enforces scope", async () => {
  const raw = await service.issue({
    bookingId,
    scopes: ["request_cancellation"],
    expiresAt: new Date("2026-08-06T00:00:00Z"),
  });
  expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await repo.findByRawToken(raw)).toBeNull();
  await expect(service.resolve(raw, "accept_time"))
    .rejects.toMatchObject({ code: "CUSTOMER_ACTION_FORBIDDEN" });
});
```

Also test expiry, revocation, malformed tokens, cancelled bookings, and rate limiting.

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/repositories/customer-action-tokens.repository.test.ts \
  src/services/customer-actions.service.test.ts
```

- [ ] **Step 3: Implement token issue and resolution**

Generate 32 random bytes, return base64url plaintext once, and store:

```ts
tokenDigest = createHash("sha256").update(rawToken).digest("hex");
```

The public read model contains only:

```ts
type CustomerBookingView = {
  kind: "experience" | "party";
  status: BookingStatus;
  locale: "en" | "zh";
  offeringLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  allowedActions: CustomerActionScope[];
  proposedTime?: { date: string; startTime: string; endTime: string };
};
```

It never returns internal IDs, other customers, audit actors, payment-provider data, or token digests.

- [ ] **Step 4: Implement customer requests**

Customer cancellation changes `confirmed` or `confirmed_paid` to `cancellation_requested`. Customer rescheduling records the requested date/start in a dedicated JSON request field and changes to `reschedule_requested`; it does not reserve the requested interval. Task 5 resolves and authorizes the `accept_time` scope but does not expose or execute that action yet.

All customer transitions create an `actorKind: "customer"` status event and an owner email in the same transaction.

- [ ] **Step 5: Keep waitlist conversion staff-controlled**

The admin confirmation action from `waitlisted` must require:

```ts
{
  expectedStatus: "waitlisted",
  toStatus: "confirmed",
  operationId: string,
  contactedCustomer: true
}
```

Reject `contactedCustomer: false` with `WAITLIST_CONTACT_REQUIRED`. Capacity is checked at conversion time; there is no automatic promotion worker.

- [ ] **Step 6: Add customer routes**

```text
GET  /api/v1/customer-bookings/:token
POST /api/v1/customer-bookings/:token/request-cancellation
POST /api/v1/customer-bookings/:token/request-reschedule
```

Apply a dedicated public rate-limit scope keyed by verified client identity plus token digest prefix. Return generic `LINK_INVALID_OR_EXPIRED` for unknown, revoked, and expired tokens.

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/repositories/customer-action-tokens.repository.test.ts \
  src/services/customer-actions.service.test.ts \
  src/routes/v1/customer-bookings.routes.test.ts \
  src/services/admin/bookings.admin.service.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat: add waitlist and secure customer actions"
```

### Task 6: Implement Exclusive Party Holds and In-Store Payment Records

**Files:**
- Create: `apps/api/src/repositories/party-workflow.repository.ts`
- Create: `apps/api/src/repositories/party-workflow.repository.test.ts`
- Create: `apps/api/src/services/party-workflow.service.ts`
- Create: `apps/api/src/services/party-workflow.service.test.ts`
- Modify: `apps/api/src/services/bookings.service.ts`
- Modify: `apps/api/src/services/bookings.service.test.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.test.ts`
- Modify: `apps/api/src/routes/v1/bookings.routes.ts`
- Modify: `apps/api/src/routes/v1/customer-bookings.routes.ts`
- Modify: `apps/api/src/routes/v1/customer-bookings.routes.test.ts`
- Modify: `apps/api/src/routes/v1/admin/bookings.routes.ts`
- Modify: `apps/api/src/plugins/services.ts`

**Interfaces:**
- Produces: `createPartyRequest(input, idempotencyKey)`.
- Produces: `proposePartyTime`, `acceptPartyTime`, `recordPartyPayment`, `expirePartyHold`, `recordPartyCharge`, and `recordPartyRefund`.
- Produces: `POST /api/v1/customer-bookings/:token/accept-time`.
- Consumes: Task 2 availability, Task 3 packages, and Task 5 customer action tokens.

- [ ] **Step 1: Write failing party rule tests**

```ts
it.each([
  { participants: 3, parents: 1 },
  { participants: 9, parents: 1 },
  { participants: 4, parents: 0 },
  { participants: 4, parents: 3 },
])("rejects invalid party attendance %#", async (input) => {
  await expect(createParty({ ...validParty, ...input }))
    .rejects.toMatchObject({ code: "PARTY_ATTENDANCE_INVALID" });
});

it("holds setup through cleanup only after awaiting payment", async () => {
  const proposed = await service.proposeTime({ ...proposal });
  expect(await hasExclusiveOverlap(proposal.interval)).toBe(false);
  await service.acceptTime({ bookingId, expectedStatus: "time_proposed" });
  expect(await hasExclusiveOverlap(proposal.interval)).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
YEZYY_RUN_DB_BOOKING_TESTS=1 corepack pnpm --filter @yezz/api test -- \
  src/services/party-workflow.service.test.ts
```

- [ ] **Step 3: Create party requests without holds**

Exact input includes:

```ts
type PartyCreateInput = {
  kind: "party";
  partyPackageId: string;
  name: string;
  phone: string;
  email: string;
  birthdayChildName: string;
  birthdayChildAge: number;
  participantCount: number;
  parentCount: 1 | 2;
  desiredDate: string;
  desiredStartTime: string;
  projectInterests: string[];
  byoCake: boolean;
  byoDrinks: boolean;
  byoFood: boolean;
  byoSnacks: boolean;
  cakeCuttingRequested: boolean;
  specialRequirements?: string;
  locale: "en" | "zh";
  policyVersion: "2026-07-30";
  policyAccepted: true;
};
```

Validate the shared horizon and lead time, participant and parent ranges, minimum age, and package existence. Store desired guest time and enter `pending_review`; do not create an exclusive hold.

- [ ] **Step 4: Implement time proposal and hold creation**

`proposePartyTime` stores:

```ts
{
  finalSetupStart: subtractMinutes(finalGuestStart, package.setupMinutes),
  finalGuestStart,
  finalGuestEnd: addMinutes(finalGuestStart, package.guestDurationMinutes),
  finalCleanupEnd: addMinutes(finalGuestEnd, package.cleanupMinutes),
  paymentDeadline,
}
```

Staff may approve setup/cleanup outside public hours, but guest use must finish by close. If the final guest time equals the desired time, staff may transition directly to `awaiting_in_store_payment`; otherwise transition to `time_proposed` and issue an `accept_time` token.

Acceptance locks the operational date, rejects every overlap with a confirmed ordinary booking or active party, and changes to `awaiting_in_store_payment` atomically.

Add the customer accept-time route now that the party transition exists:

```text
POST /api/v1/customer-bookings/:token/accept-time
```

It resolves an `accept_time`-scoped token through Task 5, calls `acceptPartyTime`, consumes the token in the same successful transaction, queues both customer and owner emails once, and returns generic `LINK_INVALID_OR_EXPIRED` for invalid tokens.

- [ ] **Step 5: Implement payment, expiry, charges, and refunds**

```ts
recordPartyPayment({
  bookingId,
  expectedStatus: "awaiting_in_store_payment",
  amountCents: 9500 | 14500,
  paidAt: Date,
  operationId,
}): Promise<PartyBookingDto>;
```

Require the amount to match the package venue fee and transition to `confirmed_paid`.

Variable charge rules:

- `cake_cutting` amount is exactly `1500`;
- `cleaning` amount is `1500..3500`;
- `overtime` amount is `1500..3500`;
- `refund` amount is exactly the recorded venue fee.

Refund eligibility compares the cancellation request time with the final guest start in Melbourne. Staff records the external refund and transitions `cancelled` to `refunded`.

- [ ] **Step 6: Verify conflict and state behaviour**

Tests must prove:

- active holds block ordinary confirmation, waitlist conversion, and other party holds;
- `time_proposed` and `pending_review` do not block;
- payment expiry releases the interval;
- an expired hold cannot be paid;
- double payment and double refund are idempotently rejected;
- setup and cleanup boundaries are included in party-vs-party conflict checks;
- legacy confirmed parties continue blocking until staff reconciles them.

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/repositories/party-workflow.repository.test.ts \
  src/services/party-workflow.service.test.ts \
  src/services/bookings.service.test.ts \
  src/services/admin/bookings.admin.service.test.ts
corepack pnpm --filter @yezz/api typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat: close exclusive party workflow"
```

### Task 7: Extend Bilingual Notifications and Maintenance Jobs

**Files:**
- Modify: `apps/api/src/lib/email-outbox-payload.ts`
- Modify: `apps/api/src/lib/email.ts`
- Modify: `apps/api/src/lib/email.test.ts`
- Modify: `apps/api/src/services/email-outbox.service.ts`
- Modify: `apps/api/src/services/email-outbox.service.test.ts`
- Create: `apps/api/src/services/booking-maintenance.service.ts`
- Create: `apps/api/src/services/booking-maintenance.service.test.ts`
- Create: `apps/api/src/repositories/booking-maintenance.repository.ts`
- Create: `apps/api/src/repositories/booking-maintenance.repository.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/startup.ts`
- Modify: `apps/api/src/startup.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: templates for every approved customer and owner event.
- Produces: `startBookingMaintenanceWorker(service): stop`.
- Consumes: booking/customer token snapshots and the existing durable email outbox.

- [ ] **Step 1: Write failing template tests**

```ts
it.each(["en", "zh"] as const)(
  "never calls a request confirmed in %s before confirmation",
  async (locale) => {
    const html = await renderEmail({
      template: "booking_received",
      locale,
      payload: receivedFixture,
    });
    expect(html).not.toMatch(locale === "zh" ? /预约已确认/ : /booking confirmed/i);
    expect(html).toMatch(locale === "zh" ? /等待人工确认/ : /awaiting.*confirmation/i);
  },
);
```

Add exact tests for proposed time, awaiting payment with deadline, payment recorded, payment expired, waitlist, cancellation request, reschedule request, reminder, rejection, and staff notification.

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/lib/email.test.ts
```

- [ ] **Step 3: Extend the typed payload union**

Add:

```ts
type CustomerManagePayload = {
  customerName: string;
  bookingNumber: string;
  offeringLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  manageUrl: string;
  storeName: "YezYY";
  contactEmail: "congdongdong03@gmail.com";
  contactPhone: "0430 787 712";
};

type BookingReminderPayload = CustomerManagePayload & {
  template: "booking_reminder";
};

type PartyPaymentPayload = CustomerManagePayload & {
  template: "party_payment_due" | "party_payment_recorded" | "party_payment_expired";
  paymentDeadline?: string;
  amountCents: 9500 | 14500;
};
```

Validate every payload before send. HTML-escape all customer and staff text.

- [ ] **Step 4: Create due-work repository methods**

```ts
findBookingsNeedingReminder(now: Date): Promise<BookingReminderCandidate[]>;
markReminderEnqueued(bookingId: string, tx: Db): Promise<void>;
findExpiredPartyHolds(now: Date): Promise<ExpiredPartyHold[]>;
```

Use PostgreSQL Melbourne conversion:

```sql
((slot_date + slot_start_time::time) AT TIME ZONE 'Australia/Melbourne')
  BETWEEN $now + interval '23 hours 55 minutes'
      AND $now + interval '24 hours 5 minutes'
```

Use dedupe keys so repeated worker polls enqueue one reminder or expiry email.

- [ ] **Step 5: Implement the maintenance worker**

```ts
export function startBookingMaintenanceWorker(
  service: Pick<BookingMaintenanceService, "runOnce">,
  options: { pollMilliseconds?: number } = {},
): () => Promise<void>;
```

Default poll is 60 seconds. `runOnce` first expires overdue holds transactionally, then queues eligible reminders. It is safe when two API instances run concurrently.

Add `BOOKING_MAINTENANCE_WORKER_ENABLED=false` to `.env.example`. Production startup validates mail configuration when either mail-producing worker is enabled.

- [ ] **Step 6: Verify durable behaviour**

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/lib/email.test.ts \
  src/services/email-outbox.service.test.ts \
  src/repositories/booking-maintenance.repository.test.ts \
  src/services/booking-maintenance.service.test.ts \
  src/startup.test.ts
corepack pnpm --filter @yezz/api typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src .env.example
git commit -m "feat: add booking notifications and maintenance"
```

### Task 8: Build the Ordinary DIY Public Booking Experience

**Files:**
- Create: `apps/web/lib/api/availability.ts`
- Create: `apps/web/lib/api/availability.test.ts`
- Create: `apps/web/components/book/AttendanceFields.tsx`
- Create: `apps/web/components/book/AttendanceFields.test.tsx`
- Create: `apps/web/components/book/ProjectQuantityPicker.tsx`
- Create: `apps/web/components/book/ProjectQuantityPicker.test.tsx`
- Create: `apps/web/components/book/PolicyConsent.tsx`
- Create: `apps/web/components/book/OrdinaryBookingForm.tsx`
- Create: `apps/web/components/book/OrdinaryBookingForm.test.tsx`
- Modify: `apps/web/components/book/BookingCalendar.tsx`
- Modify: `apps/web/components/book/BookingCalendar.test.tsx`
- Modify: `apps/web/lib/actions/booking.ts`
- Modify: `apps/web/lib/actions/booking.test.ts`
- Modify: `apps/web/app/[locale]/book/page.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Consumes: Task 2 availability DTOs, Task 3 project DTOs, and Task 4 request API.
- Produces: one mobile-first ordinary request form supporting booking and waitlist modes.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it("counts participants and accompanying adults toward eight", async () => {
  render(<AttendanceFields locale="en" />);
  await userEvent.clear(screen.getByLabelText("DIY participants"));
  await userEvent.type(screen.getByLabelText("DIY participants"), "7");
  await userEvent.clear(screen.getByLabelText("Accompanying adults"));
  await userEvent.type(screen.getByLabelText("Accompanying adults"), "2");
  expect(await screen.findByText(/maximum of 8 people/i)).toBeVisible();
});

it("uses the longest selected project duration", async () => {
  render(<ProjectQuantityPicker projects={projects} participantCount={2} />);
  await choose("Beading", 1);
  await choose("Paint clay figurine", 1);
  expect(screen.getByText(/estimated booking time: 60 minutes/i)).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/web test -- components/book
```

- [ ] **Step 3: Implement attendance and project selection**

The form state contains:

```ts
type OrdinaryFormValues = {
  name: string;
  email: string;
  phone: string;
  participantCount: number;
  youngChildCount: number;
  accompanyingAdultCount: number;
  items: Array<{ projectId?: string; quantity: number; decideInStore: boolean }>;
  date: string;
  startTime: string;
  message: string;
  policyAccepted: boolean;
};
```

Require item quantities to total participant count. If `youngChildCount > 0`, require `accompanyingAdultCount > 0`. Show total physical attendance and stop at eight.

- [ ] **Step 4: Load interval availability**

After attendance, projects, and date are valid, request:

```ts
getOrdinaryAvailability({
  date,
  durationMinutes: longestDuration,
  attendance: participantCount + accompanyingAdultCount,
});
```

Render 30-minute start buttons. Use `Join waitlist` when the selected result has `status: "waitlist"`. Refetch immediately before submission and let the API remain authoritative.

- [ ] **Step 5: Submit idempotently**

Extend `submitBooking` to send the exact Task 4 body and `mode`. Reuse `createRequestAttempt`; failed network attempts retain the idempotency key and successful attempts rotate it. Show:

- request received, awaiting manual confirmation;
- waitlist request received;
- stale slot with alternative times;
- policy, age, attendance, and field errors;
- contact fallback when the effective capability is false.

- [ ] **Step 6: Add complete bilingual copy**

English and Chinese messages cover prices, duration, ordinary DIY age-five minimum, five-to-eight supervision, eight-person physical limit, two-hour lead time, seven-day horizon, pay in store, 20-minute late policy, cancellation/rescheduling, and truthful pending status.

The contact fallback and booking confirmation surfaces use the exact canonical address, phone, operational email, Xiaohongshu ID, and AUD currency from Global Constraints.

Run:

```bash
corepack pnpm --filter @yezz/web test -- \
  lib/api/availability.test.ts \
  components/book \
  lib/actions/booking.test.ts
corepack pnpm --filter @yezz/web lint
corepack pnpm --filter @yezz/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: build ordinary DIY booking experience"
```

### Task 9: Build the Party and Customer-Management Experiences

**Files:**
- Modify: `apps/web/components/parties/PartyBookingForm.tsx`
- Modify: `apps/web/components/parties/PartyBookingForm.test.tsx`
- Modify: `apps/web/app/[locale]/parties/page.tsx`
- Create: `apps/web/lib/api/customer-booking.ts`
- Create: `apps/web/lib/api/customer-booking.test.ts`
- Create: `apps/web/components/book/CustomerBookingActions.tsx`
- Create: `apps/web/components/book/CustomerBookingActions.test.tsx`
- Create: `apps/web/app/[locale]/manage-booking/[token]/page.tsx`
- Create: `apps/web/app/[locale]/manage-booking/[token]/page.test.tsx`
- Modify: `apps/web/lib/actions/booking.ts`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Consumes: Task 6 party routes and Task 5 customer routes.
- Produces: complete party application and secure action pages.

- [ ] **Step 1: Write failing party form tests**

```tsx
it("requires 4–8 participants and 1–2 parents", async () => {
  render(<PartyBookingForm {...props} />);
  await setNumber("Participants", 3);
  await setNumber("Accompanying parents", 0);
  await userEvent.click(screen.getByRole("button", { name: /submit request/i }));
  expect(await screen.findByText(/4 to 8 participants/i)).toBeVisible();
  expect(screen.getByText(/1 or 2 accompanying parents/i)).toBeVisible();
});
```

Test package duration, birthday name/age, BYO flags, cake cutting, policy acceptance, and request-only time wording.

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/web test -- components/parties
```

- [ ] **Step 3: Implement the complete party form**

Use Task 6's exact `PartyCreateInput`. Candidate starts come from `/availability/party`, but the page says the time is a request and staff may propose another time. Show:

- $95 / 1.5 hours and $145 / 2.5 hours;
- 30-minute setup and cleanup handled by staff;
- $45 minimum DIY spend per participant;
- four-to-eight participants plus one-to-two parents;
- included decorations, gift, and 15% voucher exclusions;
- BYO rules;
- $15 cake cutting;
- $15–$35 cleaning and overtime ranges;
- in-store deposit and 48-hour refund rule.

- [ ] **Step 4: Write failing secure action page tests**

```tsx
it("shows only actions permitted by the token", async () => {
  mockCustomerBooking({ allowedActions: ["request_cancellation"] });
  render(await ManageBookingPage({ params: tokenParams }));
  expect(screen.getByRole("button", { name: /request cancellation/i })).toBeVisible();
  expect(screen.queryByRole("button", { name: /accept proposed time/i })).toBeNull();
});
```

Test invalid/expired links, proposed time acceptance, cancellation request, reschedule date/time selection, and locale.

- [ ] **Step 5: Implement customer management**

Server-load the safe read model through the BFF. Mutations post the token only in the route path, never analytics. Set:

```ts
export const metadata = { robots: { index: false, follow: false } };
```

Do not render booking IDs, token digests, audit actors, or internal notes. After action success, replace controls with a truthful pending-staff-review message.

- [ ] **Step 6: Verify public workflows**

Run:

```bash
corepack pnpm --filter @yezz/web test -- \
  components/parties \
  components/book/CustomerBookingActions.test.tsx \
  'app/[locale]/manage-booking/[token]/page.test.tsx' \
  lib/api/customer-booking.test.ts
corepack pnpm --filter @yezz/web lint
corepack pnpm --filter @yezz/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: build party and customer booking flows"
```

### Task 10: Build the Chinese Operational Admin

**Files:**
- Create: `apps/api/src/repositories/booking-calendar.repository.ts`
- Create: `apps/api/src/repositories/booking-calendar.repository.test.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.ts`
- Modify: `apps/api/src/services/admin/bookings.admin.service.test.ts`
- Modify: `apps/api/src/services/admin/settings.admin.service.ts`
- Modify: `apps/api/src/services/admin/settings.admin.service.test.ts`
- Modify: `apps/api/src/routes/v1/admin/bookings.routes.ts`
- Modify: `apps/api/src/routes/v1/admin/settings.routes.ts`
- Modify: `apps/api/src/routes/v1/admin/notifications.routes.ts`
- Modify: `apps/web/lib/admin/types.ts`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/lib/admin/booking-status.ts`
- Modify: `apps/web/lib/admin/booking-status.test.ts`
- Create: `apps/web/components/admin/BookingWorkflowDialog.tsx`
- Create: `apps/web/components/admin/BookingWorkflowDialog.test.tsx`
- Create: `apps/web/components/admin/BusinessHoursEditor.tsx`
- Create: `apps/web/components/admin/BusinessHoursEditor.test.tsx`
- Create: `apps/web/app/admin/schedule/page.tsx`
- Create: `apps/web/app/admin/schedule/page.test.tsx`
- Modify: `apps/web/app/admin/bookings/page.tsx`
- Modify: `apps/web/app/admin/bookings/page.test.tsx`
- Modify: `apps/web/app/admin/bookings/[id]/page.tsx`
- Modify: `apps/web/app/admin/settings/page.tsx`
- Modify: `apps/web/components/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6, and 7.
- Produces: seven-day Chinese calendar, full workflow actions, structured hours/closures, and staff-visible email failures.

- [ ] **Step 1: Write failing calendar read-model tests**

```ts
it("reports overlapping confirmed attendance and active party holds", async () => {
  const day = await repo.readDay("2026-07-30");
  expect(day.intervals).toContainEqual(expect.objectContaining({
    startTime: "10:00",
    ordinaryAttendance: 6,
    remainingOrdinaryCapacity: 2,
    partyBlocked: false,
  }));
  expect(day.intervals).toContainEqual(expect.objectContaining({
    startTime: "14:00",
    partyBlocked: true,
    remainingOrdinaryCapacity: 0,
  }));
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/repositories/booking-calendar.repository.test.ts
```

- [ ] **Step 3: Add admin read and action APIs**

Add:

```text
GET  /api/v1/admin/bookings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
POST /api/v1/admin/bookings/:id/transitions
POST /api/v1/admin/bookings/:id/charges
POST /api/v1/admin/bookings/:id/payment
POST /api/v1/admin/bookings/:id/refund
```

Each write requires `expectedStatus` and `operationId`. Return `409 STALE_STATUS` with the current status when another action won.

Calendar results include ordinary attendance, remaining capacity, party holds, confirmed parties, closures, payment deadlines, and email failures.

- [ ] **Step 4: Add structured schedule and switch APIs**

```text
GET   /api/v1/admin/settings/schedule
PUT   /api/v1/admin/settings/schedule/weekly
POST  /api/v1/admin/settings/schedule/special-hours
POST  /api/v1/admin/settings/schedule/closures
DELETE /api/v1/admin/settings/schedule/closures/:id
PATCH /api/v1/admin/settings/request-switches
```

The effective public capability remains:

```ts
effective.experience =
  env.REQUEST_FLOW_EXPERIENCE_ENABLED === "true" &&
  settings.experienceRequestsEnabled;
```

Apply the same rule to party and product. Product stays false.

Creating a closure that overlaps a confirmed booking or active party returns `409 SCHEDULE_CONFLICT` with affected booking numbers unless the request includes `acknowledgeExistingBookings: true`. The override never edits those bookings.

- [ ] **Step 5: Implement Chinese workflow controls**

Replace the four-state dropdown with action-specific controls. `BookingWorkflowDialog` renders only fields required for the selected action:

- confirmation: final date/start and capacity preview;
- waitlist conversion: customer-contact checkbox;
- party time proposal: guest date/start and payment deadline;
- payment: exact venue-fee amount and paid-at;
- charge: type, amount, and note;
- cancellation/refund: decision note and recorded-at;
- completion/no-show: note.

Every success refreshes the affected calendar day and detail record. Stale writes show `记录已被其他操作更新，请查看最新状态`.

- [ ] **Step 6: Implement the calendar and schedule editor**

The seven-day schedule page displays:

- 30-minute rows;
- ordinary attendance and remaining capacity;
- party setup, guest, and cleanup blocks;
- waiting payment deadline badges;
- closure and special-hours bands;
- links to booking details.

`BusinessHoursEditor` edits one opening/closing pair per weekday, full-day special closures, special opening/closing hours, and partial closures. Switch controls clearly distinguish database switch state from deployment hard-gate state.

- [ ] **Step 7: Verify admin behaviour**

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/repositories/booking-calendar.repository.test.ts \
  src/services/admin/bookings.admin.service.test.ts \
  src/services/admin/settings.admin.service.test.ts
corepack pnpm --filter @yezz/web test -- \
  lib/admin/booking-status.test.ts \
  components/admin/BookingWorkflowDialog.test.tsx \
  components/admin/BusinessHoursEditor.test.tsx \
  app/admin/bookings/page.test.tsx \
  app/admin/schedule/page.test.tsx
corepack pnpm typecheck
corepack pnpm lint
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src apps/web
git commit -m "feat: build Chinese booking operations admin"
```

### Task 11: Replace Plaintext Admin Password Handoff with Secure Setup

**Files:**
- Create: `apps/api/src/repositories/password-setup-tokens.repository.ts`
- Create: `apps/api/src/repositories/password-setup-tokens.repository.test.ts`
- Create: `apps/api/src/services/password-setup.service.ts`
- Create: `apps/api/src/services/password-setup.service.test.ts`
- Modify: `apps/api/src/services/admin/users.admin.service.ts`
- Modify: `apps/api/src/services/admin/users.admin.service.test.ts`
- Modify: `apps/api/src/routes/v1/auth.routes.ts`
- Modify: `apps/api/src/routes/v1/auth.routes.test.ts`
- Modify: `apps/api/src/routes/v1/admin/users.routes.ts`
- Modify: `apps/api/src/lib/jwt.ts`
- Modify: `apps/api/src/plugins/auth.ts`
- Modify: `apps/api/src/lib/email-outbox-payload.ts`
- Modify: `apps/api/src/lib/email.ts`
- Create: `apps/web/app/admin/setup-password/page.tsx`
- Create: `apps/web/app/admin/setup-password/page.test.tsx`
- Modify: `apps/web/app/admin/users/page.tsx`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/lib/admin/types.ts`
- Modify: `packages/db/src/bootstrap-production.ts`
- Modify: `packages/db/src/bootstrap-production.test.ts`

**Interfaces:**
- Produces: one Owner account for `congdongdong03@gmail.com`.
- Produces: one-use 60-minute setup/reset token.
- Removes: API/UI plaintext `initialPassword` and `newPassword` responses.

- [ ] **Step 1: Write failing password-handoff tests**

```ts
it("returns no plaintext password and queues a setup link", async () => {
  const result = await service.create({
    email: "congdongdong03@gmail.com",
    name: "YezYY Owner",
    role: "owner",
  });
  expect(result).toEqual({ user: expect.objectContaining({ role: "owner" }) });
  expect(JSON.stringify(result)).not.toMatch(/password/i);
  expect(await latestOutbox()).toMatchObject({
    messageType: "admin_password_setup",
    recipient: "congdongdong03@gmail.com",
  });
});
```

Test one-use, expiry, revoked previous tokens, 12-character password minimum, and no password in logs/email.

- [ ] **Step 2: Verify RED**

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/services/admin/users.admin.service.test.ts \
  src/services/password-setup.service.test.ts
```

- [ ] **Step 3: Implement secure setup**

Create a user with a random 32-byte unreturned bootstrap password hash, issue a random setup token, store only its SHA-256 digest, and queue:

```text
https://yezyy.com/admin/setup-password?token=<raw-token>
```

The token expires after 60 minutes. Setting a password updates the bcrypt hash, marks the token used, revokes sibling tokens, and increments `users.session_version` in the same transaction. Newly issued JWTs contain that exact version. `apps/api/src/plugins/auth.ts` rejects a token when its version differs from the current user row, so all older sessions stop working immediately.

- [ ] **Step 4: Add owner role protection**

Expand `UserRole` to `"owner" | "admin" | "staff"`. Only an owner can create/delete admins or change an owner role. The sole owner cannot delete or demote themselves.

The production bootstrap is idempotent:

```ts
await ensureOwnerAccount({
  email: "congdongdong03@gmail.com",
  name: "YezYY Owner",
});
```

It creates no password output and sends a setup email only when the account needs setup.

- [ ] **Step 5: Build the setup page**

The page accepts token, new password, and confirmation. It does not store the token in localStorage, does not emit analytics, sets `noindex`, and replaces the form with a login link after success.

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/repositories/password-setup-tokens.repository.test.ts \
  src/services/password-setup.service.test.ts \
  src/services/admin/users.admin.service.test.ts \
  src/routes/v1/auth.routes.test.ts
corepack pnpm --filter @yezz/web test -- app/admin/setup-password/page.test.tsx
corepack pnpm --filter @yezz/db test -- src/bootstrap-production.test.ts
corepack pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps packages/db
git commit -m "feat: secure owner password setup"
```

### Task 12: Close End-to-End Flows and Prepare a Gated Deployment

**Files:**
- Create: `apps/web/e2e/live-ordinary-booking.spec.ts`
- Create: `apps/web/e2e/live-waitlist.spec.ts`
- Create: `apps/web/e2e/live-party-booking.spec.ts`
- Create: `apps/web/e2e/live-customer-actions.spec.ts`
- Modify: `apps/web/e2e/fixtures/closure-database.ts`
- Modify: `apps/web/e2e/fixtures/mailpit.ts`
- Modify: `apps/web/e2e/run-closure.mjs`
- Modify: `apps/web/playwright.config.ts`
- Modify: `apps/web/lib/testing/production-checklist.test.ts`
- Modify: `docs/production-config-checklist.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: evidence that every approved workflow closes in English, Chinese, mobile, and desktop.
- Produces: a deployment checklist that cannot open request capabilities accidentally.

- [ ] **Step 1: Add deterministic test fixtures**

Seed only isolated test-schema records:

```ts
await seedLiveBookingFixture({
  weeklyHours: APPROVED_WEEKLY_HOURS,
  projects: LIVE_DIY_PROJECTS,
  parties: LIVE_PARTY_PACKAGES,
  capabilities: { experience: true, party: true, product: false },
});
```

Mailpit captures customer and owner emails. The fixture cleanup deletes only records carrying the generated test-run ID and never connects when the database host matches the production allowlist.

- [ ] **Step 2: Write the ordinary closure E2E**

The test performs:

```text
English customer request
→ request-received email
→ Chinese admin confirmation
→ confirmation email with secure link
→ 24-hour reminder worker fixture
→ Chinese admin completion
```

It also proves mixed project duration, total physical attendance, duplicate-submit idempotency, stale-slot handling, and no capacity reservation while pending.

- [ ] **Step 3: Write waitlist and party closure E2E**

Waitlist:

```text
full interval
→ waitlist request
→ owner email
→ capacity release
→ staff marks customer contacted
→ staff conversion
→ customer confirmation email
```

Party:

```text
Chinese request
→ staff proposes time and deadline
→ customer accepts secure link
→ exclusive temporary hold
→ staff records $95/$145 in-store payment
→ party confirmation email
→ ordinary overlap rejected
→ party completed
```

Add a separate expiry case proving the hold releases and a 48-hour cancellation case proving refund eligibility.

- [ ] **Step 4: Write customer-action and security E2E**

Prove:

- cancellation and rescheduling requests are staff-reviewed;
- expired/revoked tokens reveal no customer data;
- token pages are not indexed and do not emit analytics;
- cross-customer access is impossible;
- repeated submit/action requests do not duplicate events or email;
- capability-off public pages show contact fallback and mutation routes return `REQUEST_FLOW_DISABLED`.

- [ ] **Step 5: Run the complete local verification gate**

Run:

```bash
corepack pnpm build:db
corepack pnpm typecheck
corepack pnpm test:api
corepack pnpm --filter @yezz/db test
corepack pnpm --filter @yezz/web test
corepack pnpm lint
corepack pnpm build:api
corepack pnpm build
corepack pnpm test:e2e:closure
```

Expected: all commands pass. If the local PostgreSQL/Mailpit services are unavailable, start only the repository's `docker-compose.test.yml` services and rerun; never substitute production services.

- [ ] **Step 6: Update the production checklist**

Document these exact initial values:

```dotenv
EMAIL_FROM="YezYY Bookings <bookings@yezyy.com>"
EMAIL_REPLY_TO="congdongdong03@gmail.com"
OWNER_EMAIL="congdongdong03@gmail.com"
STORE_TIMEZONE="Australia/Melbourne"
EMAIL_OUTBOX_WORKER_ENABLED=false
BOOKING_MAINTENANCE_WORKER_ENABLED=false
REQUEST_FLOW_EXPERIENCE_ENABLED=false
REQUEST_FLOW_PARTY_ENABLED=false
REQUEST_FLOW_PRODUCT_ENABLED=false
```

The checklist requires:

- apply migration;
- seed approved service content with the explicit confirmation variable;
- verify Resend domain DNS;
- deploy web and API with all gates false;
- run read-only production health, settings, and capability checks;
- verify no production test records;
- after DNS and configuration verification, enable only `EMAIL_OUTBOX_WORKER_ENABLED`, create/send the Owner setup link, and verify Owner login;
- report readiness;
- keep `BOOKING_MAINTENANCE_WORKER_ENABLED=false` until ordinary DIY or party opens;
- wait for a new explicit owner instruction before enabling ordinary/party public switches;
- keep product false.

- [ ] **Step 7: Commit**

```bash
git add apps/web/e2e apps/web/lib/testing apps/web/playwright.config.ts docs/production-config-checklist.md .env.example
git commit -m "test: verify live booking launch gate"
```

## Final Execution Gate

After all tasks pass:

1. Run `git status --short` and confirm only intentional files are changed.
2. Run the complete Task 12 verification command again from a clean shell.
3. Review the diff specifically for secrets, production identifiers, accidental capability enablement, and fictional content.
4. Use the branch-finishing workflow to choose integration.
5. Deploy only with all three public request environment gates false.
6. Do not enable ordinary DIY or party until the owner gives a new explicit instruction after reviewing the production-ready result.
