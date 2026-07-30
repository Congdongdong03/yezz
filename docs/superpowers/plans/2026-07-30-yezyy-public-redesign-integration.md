# YezYY Public Redesign Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the approved warm-rose public visual redesign into the production-readiness branch without changing verified booking, party, product, or admin business behaviour.

**Architecture:** Treat `codex/yezyy-production-phase-1` as the behavioural source of truth and `codex/yezyy-public-redesign` as the visual/content source of truth. Port public UI changes file by file rather than merging branches. For every overlapping component, retain the current branch's data contracts, actions, accessibility semantics, request gates, and tests; only transplant layout, typography, image presentation, and approved bilingual copy.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, next-intl, Vitest, Playwright.

## Global Constraints

- Keep `REQUEST_FLOW_EXPERIENCE_ENABLED=false`, `REQUEST_FLOW_PARTY_ENABLED=false`, and `REQUEST_FLOW_PRODUCT_ENABLED=false` in production configuration.
- Public content must remain bilingual; Chinese admin screens remain Chinese.
- Do not alter Owner credentials or expose password material.
- Preserve manual confirmation and pay-in-store language across all booking surfaces.
- Use only approved/local or appropriately licensed public media; do not copy competitor assets.
- Keep current booking horizon, capacity, safety, and request-gating behaviour unchanged.

---

### Task 1: Create a guarded integration baseline

**Files:**
- Modify: `apps/web/e2e/fixtures/closure-database.ts`
- Test: `apps/web/lib/closure-fixture-date.test.ts`
- Verify: `apps/web/e2e/experience-closure.spec.ts`, `apps/web/e2e/email-retry.spec.ts`, `apps/web/e2e/rate-limit-identity.spec.ts`

**Interfaces:**
- Consumes: `selectClosureBookingDate(now?: Date): string`.
- Produces: a closure fixture date that is within the seven-day customer booking horizon.

- [x] **Step 1: Write the failing date-boundary tests**

```ts
expect(selectClosureBookingDate(new Date("2026-08-03T00:00:00.000Z"))).toBe("2026-08-06");
expect(selectClosureBookingDate(new Date("2026-08-04T00:00:00.000Z"))).toBe("2026-08-07");
```

- [x] **Step 2: Run the tests and observe the missing-function failure**

Run: `corepack pnpm --filter @yezz/web test -- lib/closure-fixture-date.test.ts`

- [x] **Step 3: Select the same Melbourne-calendar date three days ahead for all closure fixtures**

```ts
export function selectClosureBookingDate(now: Date = new Date()): string {
  const candidate = new Date(now.getTime() + 3 * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(candidate);
}
```

- [x] **Step 4: Verify the focused and live closure tests**

Run: `corepack pnpm --filter @yezz/web test -- lib/closure-fixture-date.test.ts`

Run: `corepack pnpm test:e2e:closure -- e2e/rate-limit-identity.spec.ts e2e/email-retry.spec.ts e2e/experience-closure.spec.ts`

- [x] **Step 5: Commit the independent regression fix**

Commit: `4eef35c test(closure): keep fixture dates within booking horizon`

### Task 2: Port shared public presentation primitives

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/[locale]/layout.tsx`
- Modify: `apps/web/components/*` public shell, navigation, footer, and media components selected from `codex/yezyy-public-redesign`
- Test: affected layout and public surface component tests

**Interfaces:**
- Consumes: existing `next-intl` locale routing, public route metadata, and request-flow feature flags.
- Produces: a unified warm-rose YezYY public shell with no dark `#2d2d2f` fields and no changes to API calls.

- [ ] **Step 1: Write one failing test for the preserved public navigation and footer labels in each locale.**

```tsx
expect(screen.getByRole("link", { name: "Book a visit" })).toHaveAttribute("href", "/en/book");
expect(screen.getByRole("link", { name: "预约到店" })).toHaveAttribute("href", "/zh/book");
```

- [ ] **Step 2: Run the focused layout test and confirm the expected legacy-shell failure.**

Run: `corepack pnpm --filter @yezz/web test -- app/[locale]/layout.test.tsx`

- [ ] **Step 3: Port only the visual tokens, public shell markup, and licensed-media components.**

Keep existing route guards, links, locale behaviour, cart visibility rules, and semantic landmarks.

- [ ] **Step 4: Run the focused layout and public surface tests.**

Run: `corepack pnpm --filter @yezz/web test -- app/[locale]/layout.test.tsx components/PublicSurfaceStates.test.tsx`

- [ ] **Step 5: Commit the shell-only change.**

Commit message: `feat(public): apply YezYY visual shell`

### Task 3: Port public pages without replacing workflow logic

**Files:**
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: `apps/web/app/[locale]/gallery/page.tsx`
- Modify: `apps/web/app/[locale]/contact/page.tsx`
- Modify: `apps/web/app/[locale]/projects/page.tsx`
- Modify: `apps/web/app/[locale]/projects/[slug]/page.tsx`
- Modify: `apps/web/app/[locale]/parties/page.tsx`
- Modify: `apps/web/app/[locale]/book/page.tsx`
- Modify: `apps/web/app/[locale]/booking-policy/page.tsx`
- Modify: `apps/web/app/[locale]/privacy/page.tsx`
- Modify: `apps/web/app/[locale]/terms/page.tsx`
- Test: matching page tests and `apps/web/components/book/OrdinaryBookingForm.test.tsx`

**Interfaces:**
- Consumes: current booking availability endpoint, `OrdinaryBookingForm`, `PartyBookingForm`, feature gates, and bilingual messages.
- Produces: redesigned pages that use the same live forms, manual-review wording, and public availability rules.

- [ ] **Step 1: Add page-level tests asserting the redesigned sections keep their existing form components and disabled-state fallback.**

```tsx
expect(screen.getByText("Manual confirmation required")).toBeVisible();
expect(screen.queryByRole("button", { name: "Send booking request" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run each affected page test before code changes.**

Run: `corepack pnpm --filter @yezz/web test -- app/[locale]/page.test.tsx app/[locale]/book/page.test.tsx app/[locale]/parties/page.test.tsx`

- [ ] **Step 3: Transfer composition, cards, typography, media, and approved bilingual copy one page at a time.**

Do not copy stale request submitters, product/cart transport, or older booking management implementations from the redesign branch.

- [ ] **Step 4: Verify component and page tests after each page group.**

Run: `corepack pnpm --filter @yezz/web test -- app/[locale]/page.test.tsx app/[locale]/gallery/page.test.tsx app/[locale]/contact/page.test.tsx app/[locale]/projects/page.test.tsx app/[locale]/parties/page.test.tsx app/[locale]/book/page.test.tsx`

- [ ] **Step 5: Commit each independently reviewable page group.**

Commit messages: `feat(public): redesign discovery pages`; `feat(public): redesign booking surfaces`.

### Task 4: Preserve and visually validate admin and customer management routes

**Files:**
- Modify only public-facing wrappers needed by `apps/web/app/[locale]/manage-booking/[token]/page.tsx`
- Do not replace: `apps/web/app/admin/**`, `apps/api/**`, current booking services, repositories, or migrations
- Test: `apps/web/app/[locale]/manage-booking/[token]/page.test.tsx`, current admin tests, and closure E2E specs

**Interfaces:**
- Consumes: current customer action tokens, Chinese admin route behaviour, and delivery ledger UI.
- Produces: unchanged admin functionality and a customer management page consistent with the public visual language.

- [ ] **Step 1: Add a failing test for the redesigned management wrapper while retaining the current action controls.**

```tsx
expect(screen.getByRole("button", { name: "Request a new time" })).toBeVisible();
expect(screen.getByText("YezYY" )).toBeVisible();
```

- [ ] **Step 2: Run the focused management test and record its legacy-layout failure.**

Run: `corepack pnpm --filter @yezz/web test -- app/[locale]/manage-booking/[token]/page.test.tsx`

- [ ] **Step 3: Apply wrapper-level styles only; preserve current status transitions and token handling.**

- [ ] **Step 4: Run all web tests and current closure E2E tests.**

Run: `corepack pnpm --filter @yezz/web test`

Run: `corepack pnpm test:e2e:closure -- e2e/rate-limit-identity.spec.ts e2e/email-retry.spec.ts e2e/experience-closure.spec.ts`

- [ ] **Step 5: Commit the management visual alignment.**

Commit message: `feat(public): align customer booking management styling`

### Task 5: Perform integration verification and handoff

**Files:**
- Verify: `apps/web/app/globals.css`, all changed public routes, `apps/web/e2e/**`, `apps/api/**`
- Verify: `docs/production-config-checklist.md`

**Interfaces:**
- Consumes: completed public UI port and current production-readiness behaviour.
- Produces: a reviewable branch with public gates still disabled and no deployment performed.

- [ ] **Step 1: Run type checking, web tests, API tests, lint, and production build.**

Run: `corepack pnpm verify`

- [ ] **Step 2: Run the isolated database/closure release checks.**

Run: `corepack pnpm verify:release`

- [ ] **Step 3: Visually inspect `/en`, `/zh`, `/en/book`, `/en/parties`, `/en/gallery`, and `/admin` at desktop and mobile widths.**

Confirm warm rose surfaces, readable contrast, no public request entry enabled, and no raw/missing media.

- [ ] **Step 4: Request an independent review of only the integration diff.**

Verify that backend booking behaviour, owner setup, public gates, and admin functions are retained.

- [ ] **Step 5: Present the integration branch for the user's explicit merge/push choice.**

Do not deploy or enable any public request flow as part of this task.
