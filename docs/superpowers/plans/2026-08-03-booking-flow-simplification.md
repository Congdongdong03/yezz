# Booking Flow Simplification Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ordinary DIY and party requests faster to understand and complete while preserving all live booking, pricing, capacity, manual-confirmation, and in-store-payment rules.

**Architecture:** Keep the API contracts and server-authoritative validation unchanged. Simplify only the public React presentation layer by adding progressive disclosure, compact summaries, conditional fields, and step-local validation. Extend the existing bilingual message catalog and prove every behavioural change with focused component tests before running the full production release suite.

**Tech Stack:** Next.js 16, React 19, TypeScript, next-intl, Vitest/Testing Library, Playwright, Tailwind CSS, pnpm.

---

## Task 1: Group air-dry cream projects without losing selections

**Files:**
- Modify: `apps/web/components/book/ProjectQuantityPicker.test.tsx`
- Modify: `apps/web/components/book/ProjectQuantityPicker.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Step 1: Write the failing component tests**

Add fixtures covering all five canonical cream-piping groups plus an unknown future item. Assert that:

- each bilingual group heading renders;
- a group initially shows no more than three unselected projects;
- `Show more` reveals the remaining projects and `Show less` collapses them;
- a selected fourth project remains visible after collapse;
- an unknown item appears under `More choices`;
- `aria-expanded` and the controlled region id are wired correctly.

**Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @yezz/web test -- ProjectQuantityPicker.test.tsx
```

Expected: FAIL because grouping and expansion do not exist yet.

**Step 3: Implement the smallest grouping layer**

In `ProjectQuantityPicker.tsx`:

- detect the cream-piping category using its canonical category slug/name;
- map canonical English project names to the five approved display groups;
- send unmatched projects to `moreChoices`;
- store expansion state per group;
- derive collapsed items as the first three plus every selected item;
- keep quantity controls and the existing selection callback unchanged.

The core selection rule should remain presentation-only:

```ts
const visibleProjects = expanded
  ? projects
  : projects.filter((project, index) => index < 3 || getQuantity(project.id) > 0);
```

Add only the bilingual group and expand/collapse strings needed by this component.

**Step 4: Run the focused test and verify GREEN**

Run the same Vitest command. Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/components/book/ProjectQuantityPicker.tsx apps/web/components/book/ProjectQuantityPicker.test.tsx apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: group cream piping projects"
```

## Task 2: Simplify attendance, time, policy, and photo controls

**Files:**
- Modify: `apps/web/components/book/AttendanceFields.test.tsx`
- Modify: `apps/web/components/book/AttendanceFields.tsx`
- Modify: `apps/web/components/book/BookingCalendar.test.tsx`
- Modify: `apps/web/components/book/BookingCalendar.tsx`
- Create: `apps/web/components/book/PolicyConsent.test.tsx`
- Modify: `apps/web/components/book/PolicyConsent.tsx`
- Modify: `apps/web/components/book/PhotoConsentField.test.tsx`
- Modify: `apps/web/components/book/PhotoConsentField.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Step 1: Write failing tests for each compact control**

Prove these exact behaviours:

- attendance has one shared capacity explanation, not four field-level copies;
- the 5–8 supervision notice is absent at zero children and appears when children are selected;
- available slots render their start time as the visible label while the accessible label retains the interval and request meaning;
- waitlist slots retain a visible waitlist marker;
- policy consent shows exactly three approved rule summaries and the three policy links;
- photo permission starts collapsed and declined, expands on opt-in, and resets both decision and signer name when collapsed.

**Step 2: Run focused tests and verify RED**

```bash
pnpm --filter @yezz/web test -- AttendanceFields.test.tsx BookingCalendar.test.tsx PolicyConsent.test.tsx PhotoConsentField.test.tsx
```

Expected: FAIL on the new copy and disclosure expectations.

**Step 3: Implement compact attendance and time presentation**

- Remove repeated per-input capacity descriptions from `AttendanceFields`.
- Keep one age statement and one total-capacity summary.
- Render the supervision alert only when `childrenAged5To8 > 0`.
- Add one request explanation above the slot grid.
- Render available slot button text as the localized start time only.
- Preserve current selection, refresh, waitlist, disabled, error, and retry behaviour.

**Step 4: Implement concise policy consent**

Replace the current seven-item summary and repeated contact details with exactly:

1. staff confirmation is required;
2. payment is in store, not online;
3. minimum age 5, maximum attendance 8, and the 20-minute late-arrival consequence.

Keep the booking, cancellation/rescheduling, and privacy links plus the required checkbox.

**Step 5: Implement optional photo disclosure**

Use local expansion state. The collapsed state means declined. On collapse:

```ts
onDecisionChange("declined");
onSignerNameChange("");
```

Expose `aria-expanded`/`aria-controls`, show adult/minor choices only when expanded, and retain signer validation for consent choices.

**Step 6: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

**Step 7: Commit**

```bash
git add apps/web/components/book apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: simplify booking form controls"
```

## Task 3: Shorten the ordinary booking final step

**Files:**
- Modify: `apps/web/components/book/OrdinaryBookingForm.test.tsx`
- Modify: `apps/web/components/book/OrdinaryBookingForm.tsx`
- Modify: `apps/web/e2e/live-ordinary-booking.spec.ts`

**Step 1: Write the failing integration test**

Navigate through all four ordinary booking steps and assert that the final step contains only name, phone, email, the compact policy block, and the collapsed photo disclosure. Assert that the general notes textarea is absent while submission still sends the same required booking fields and manual-confirmation request.

**Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @yezz/web test -- OrdinaryBookingForm.test.tsx
```

Expected: FAIL because notes and old final-step content still render.

**Step 3: Remove the ordinary notes input without changing the API contract**

- Remove the notes field from the visible form and local ordinary-form state.
- Omit it or send the existing empty/default value expected by the action boundary.
- Keep name, phone, email, policy acceptance, photo decision, idempotency, availability refresh, and server error handling unchanged.
- Update the ordinary Playwright flow to use compact times and the disclosure control.

**Step 4: Run component tests and verify GREEN**

```bash
pnpm --filter @yezz/web test -- OrdinaryBookingForm.test.tsx ProjectQuantityPicker.test.tsx AttendanceFields.test.tsx BookingCalendar.test.tsx PolicyConsent.test.tsx PhotoConsentField.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/components/book/OrdinaryBookingForm.tsx apps/web/components/book/OrdinaryBookingForm.test.tsx apps/web/e2e/live-ordinary-booking.spec.ts
git commit -m "feat: shorten ordinary booking completion"
```

## Task 4: Remove repeated party payment explanations

**Files:**
- Modify: `apps/web/app/[locale]/parties/page.test.tsx`
- Modify: `apps/web/app/[locale]/parties/page.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Step 1: Write the failing page test**

Assert that the hero contains the one prominent manual-confirmation/in-store-payment explanation, package cards contain duration/price/inclusions without the repeated request paragraph, and the lower duplicate payment card is gone.

**Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @yezz/web test -- 'app/[locale]/parties/page.test.tsx'
```

Expected: FAIL because the duplicate package and information copy remains.

**Step 3: Simplify the party marketing layout**

- Retain the hero payment/deposit callout.
- Remove `timeRequest` from each package card.
- Remove the third lower payment information card.
- Rebalance the remaining included/BYO cards into a two-column responsive layout.
- Leave the collapsed FAQ answer available.

**Step 4: Run the focused test and verify GREEN**

Run the same Vitest command. Expected: PASS.

**Step 5: Commit**

```bash
git add 'apps/web/app/[locale]/parties/page.tsx' 'apps/web/app/[locale]/parties/page.test.tsx' apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: streamline party offer content"
```

## Task 5: Convert the party request to three progressive steps

**Files:**
- Modify: `apps/web/components/parties/PartyBookingForm.test.tsx`
- Modify: `apps/web/components/parties/PartyBookingForm.tsx`
- Modify: `apps/web/e2e/live-party-booking.spec.ts`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Step 1: Write failing navigation and conditional-field tests**

Assert that:

- only the active step is in the document;
- Continue validates only the current step and does not show untouched errors before interaction;
- Back/Continue preserve values;
- `Not sure yet` clears concrete interests and a concrete interest clears `Not sure yet`;
- cake cutting is absent until Cake is selected and is cleared when Cake is deselected;
- final submission preserves all existing API payload assertions;
- a final validation error returns to the first invalid step.

**Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @yezz/web test -- PartyBookingForm.test.tsx
```

Expected: FAIL because the current form renders all fields at once.

**Step 3: Add the three-step state machine**

Add `currentStep` with step-local render sections:

```ts
type PartyStep = 1 | 2 | 3;
const [currentStep, setCurrentStep] = useState<PartyStep>(1);
```

Create small validation helpers that return field errors for each step. Continue validates only the active step; submit validates every step and navigates to the first invalid one. Focus the first invalid control after rendering the step.

**Step 4: Add mutually exclusive project uncertainty and conditional cake cutting**

- Add a stable `Not sure yet` interest value while keeping the existing `projects: string[]` payload shape.
- Make uncertainty mutually exclusive with concrete interests.
- Control BYO Cake state.
- Render cake-cutting only when Cake is true, and clear the value immediately when Cake becomes false.

**Step 5: Remove repeated form-level payment copy**

The selected package summary remains visible, but remove the duplicate request/payment paragraphs already explained in the page hero.

**Step 6: Update the browser flow and run focused tests**

```bash
pnpm --filter @yezz/web test -- PartyBookingForm.test.tsx 'app/[locale]/parties/page.test.tsx'
```

Expected: PASS. Update `live-party-booking.spec.ts` to proceed through all three steps and assert conditional Cake behaviour.

**Step 7: Commit**

```bash
git add apps/web/components/parties/PartyBookingForm.tsx apps/web/components/parties/PartyBookingForm.test.tsx apps/web/e2e/live-party-booking.spec.ts apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: add progressive party request flow"
```

## Task 6: Integrate, visually inspect, and release

**Files:**
- Modify if required: `apps/web/e2e/public-trust-layer.spec.ts`
- Modify if required: focused files above only

**Step 1: Run all web component tests**

```bash
pnpm --filter @yezz/web test
```

Expected: all tests pass with no weakened payload or policy assertions.

**Step 2: Run static and production-build checks**

```bash
pnpm typecheck
pnpm lint
pnpm build:api
pnpm build
```

Expected: all commands exit 0.

**Step 3: Run booking integration tests against isolated PostgreSQL**

```bash
pnpm test:api:booking-db:closure
```

Expected: all server-authoritative ordinary and party booking tests pass.

**Step 4: Visually inspect both locales and breakpoints**

Run the local web/API stack and inspect:

- `/en/book` and `/zh/book` at mobile and desktop widths;
- `/en/parties` and `/zh/parties` at mobile and desktop widths;
- cream group expansion with a selected hidden item;
- attendance with and without a 5–8-year-old;
- compact available/waitlist slots;
- collapsed/expanded photo permission;
- all three party steps and conditional Cake cutting.

Capture screenshots for the implementation record and correct only defects within this approved scope.

**Step 5: Run closure E2E and full release verification**

```bash
pnpm test:e2e:closure
pnpm verify:release
```

Expected: desktop/mobile customer flows and the complete release suite pass.

**Step 6: Perform final self-review**

Inspect `git diff main...HEAD`, search for stale duplicate strings, run `git diff --check`, and verify product/cart remain disabled and no admin/API/schema/email changes were introduced.

**Step 7: Commit any verification-only corrections**

```bash
git add <only-the-corrected-files>
git commit -m "test: close booking simplification coverage"
```

**Step 8: Deploy and smoke-test production**

Deploy using the repository's existing Vercel/Fly release workflow. Confirm:

- `https://yezyy.com/en/book` and `/zh/book` show the simplified ordinary flow;
- `https://yezyy.com/en/parties` and `/zh/parties` show the simplified party flow;
- ordinary and party entry points remain open;
- product/cart remains closed;
- API health and capability endpoints remain healthy;
- email worker remains disabled until the production Resend key is valid.

Do not submit a real customer booking during production smoke testing.
