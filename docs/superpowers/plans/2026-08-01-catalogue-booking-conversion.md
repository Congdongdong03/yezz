# Catalogue-to-Booking Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer choose a bookable catalogue variant and arrive at the ordinary DIY booking form with that project safely preselected.

**Architecture:** The project-detail server route reads the live experience capability and renders variant-level links containing an operational project ID. The booking server route accepts that ID only when it matches its server-loaded bookable project list, then initializes the existing client form through an explicit prop. Existing server booking validation remains authoritative.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, existing Node API and PostgreSQL closure harness.

## Global Constraints

- Keep ordinary booking and party booking enabled through their existing settings capability gates.
- Keep product ordering disabled.
- Preserve manual confirmation, pay-in-store, two-hour lead time, seven-day horizon, 30-minute starts, capacity rules, and all existing policies.
- Do not add or change prices, project data, photos, database schema, or email timing.
- Invalid or stale project query values must never bypass the server-provided bookable-project list.
- Public content remains bilingual; admin remains Chinese.

---

### Task 1: Wire the live request capability into project details

**Files:**
- Create: `apps/web/app/[locale]/projects/[slug]/page.test.tsx`
- Modify: `apps/web/app/[locale]/projects/[slug]/page.tsx`

**Interfaces:**
- Consumes: `loadCatalogueEntry(slug)` and `loadSiteSettings()`.
- Produces: `CatalogueDetail` receives `requestEnabled: boolean` from `requestCapabilities.experience`.

- [ ] **Step 1: Write the failing route test**

Mock `loadCatalogueEntry`, `loadSiteSettings`, and `CatalogueDetail`. Render the async page with the capability enabled and assert the captured `requestEnabled` prop is `true`. Add a second assertion for `false`.

```tsx
expect(capturedProps.requestEnabled).toBe(true);
state.experienceEnabled = false;
expect(capturedProps.requestEnabled).toBe(false);
```

- [ ] **Step 2: Run the route test and verify it fails**

Run: `pnpm --filter @yezz/web test -- 'app/[locale]/projects/[slug]/page.test.tsx'`

Expected: FAIL because the route currently passes `requestEnabled={false}`.

- [ ] **Step 3: Implement live capability wiring**

Load catalogue and settings concurrently, keep the existing not-found/service-unavailable behavior, and pass:

```tsx
requestEnabled={settings.requestCapabilities.experience}
```

- [ ] **Step 4: Run the route test and verify it passes**

Run: `pnpm --filter @yezz/web test -- 'app/[locale]/projects/[slug]/page.test.tsx'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/[locale]/projects/[slug]/page.tsx apps/web/app/[locale]/projects/[slug]/page.test.tsx
git commit -m "fix(public): honor booking gate on catalogue details"
```

### Task 2: Add truthful variant-level booking actions

**Files:**
- Create: `apps/web/components/catalogue/CatalogueBookingLink.tsx`
- Create: `apps/web/components/catalogue/CatalogueBookingLink.test.tsx`
- Modify: `apps/web/components/catalogue/CatalogueDetail.tsx`
- Modify: `apps/web/components/catalogue/CatalogueDetail.test.tsx`
- Modify: `apps/web/lib/analytics/gtag.ts`

**Interfaces:**
- Consumes: `entry.variants[].bookable`, `entry.variants[].projectId`, locale, and the effective request gate.
- Produces: `/{locale}/book?project=<encoded-project-id>` links and `begin_booking` analytics events when analytics is configured.

- [ ] **Step 1: Add failing detail tests**

Cover all three states:

```tsx
expect(openHtml).toContain('/en/book?project=melty-project');
expect(closedHtml).toContain('data-testid="request-contact-fallback"');
expect(unbookableHtml).not.toContain('/book?project=');
```

Also assert the English and Chinese actions name the variant and communicate manual confirmation plus in-store payment.

- [ ] **Step 2: Run the component tests and verify failure**

Run: `pnpm --filter @yezz/web test -- components/catalogue/CatalogueDetail.test.tsx`

Expected: FAIL because the open detail currently renders no action.

- [ ] **Step 3: Implement the client tracking link**

Add a focused client component using `next/link` and a new analytics helper:

```ts
trackEvent("begin_booking", {
  project_id: projectId,
  project_name: projectName,
  source: "catalogue_detail",
});
```

The component must preserve normal link behavior and work when `NEXT_PUBLIC_GA_ID` is absent.

- [ ] **Step 4: Render only safe actions**

In `CatalogueDetail`, render a booking action only when both `requestEnabled` and `variant.bookable` are true. Render the canonical contact fallback only when the capability is false. When the gate is open but a variant is not bookable, show a bilingual `Ask in store` / `到店咨询` label without a booking link.

- [ ] **Step 5: Run detail and link tests**

Run: `pnpm --filter @yezz/web test -- components/catalogue/CatalogueDetail.test.tsx components/catalogue/CatalogueBookingLink.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/catalogue apps/web/lib/analytics/gtag.ts
git commit -m "feat(public): add catalogue booking actions"
```

### Task 3: Safely preselect the chosen project in ordinary booking

**Files:**
- Create: `apps/web/app/[locale]/book/page.test.tsx`
- Modify: `apps/web/app/[locale]/book/page.tsx`
- Modify: `apps/web/components/book/OrdinaryBookingForm.tsx`
- Modify: `apps/web/components/book/OrdinaryBookingForm.test.tsx`

**Interfaces:**
- Consumes: optional `searchParams.project: string | string[] | undefined`.
- Produces: optional `initialProjectId?: string` for `OrdinaryBookingForm`; the form initializes one item only when the ID exists in `projects`.

- [ ] **Step 1: Write failing booking-form tests**

Render with a valid initial ID and assert the matching quantity is `1`, total assigned is `1 of 1`, and another project can still be selected after changing quantities. Render with an invalid ID and assert all quantities remain `0`.

```tsx
<OrdinaryBookingForm
  initialProjectId={projects[0].id}
  locale="en"
  projects={projects}
  requestEnabled
/>
```

- [ ] **Step 2: Verify the form tests fail**

Run: `pnpm --filter @yezz/web test -- components/book/OrdinaryBookingForm.test.tsx`

Expected: FAIL because the prop does not exist.

- [ ] **Step 3: Implement validated client initialization**

Add `initialProjectId?: string` and initialize items through a lazy state initializer:

```ts
const initialProject = projects.find((project) => project.id === initialProjectId);
return initialProject
  ? [{ projectId: initialProject.id, quantity: 1, decideInStore: false }]
  : [];
```

- [ ] **Step 4: Write the failing booking-page test**

Mock the project list and `OrdinaryBookingForm`. Assert that a matching query value is forwarded and a missing, array, product, unbookable, or unknown value becomes `undefined`.

- [ ] **Step 5: Implement server-side query validation**

Accept `searchParams` in the page props, normalize only a single string, and match it against the filtered `projects` list before passing `initialProjectId`.

- [ ] **Step 6: Run all focused booking tests**

Run: `pnpm --filter @yezz/web test -- components/book/OrdinaryBookingForm.test.tsx 'app/[locale]/book/page.test.tsx'`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/[locale]/book apps/web/components/book/OrdinaryBookingForm.tsx apps/web/components/book/OrdinaryBookingForm.test.tsx
git commit -m "feat(booking): preselect catalogue project"
```

### Task 4: Prove the browser handoff on desktop and mobile

**Files:**
- Modify: `apps/web/e2e/live-ordinary-booking.spec.ts`

**Interfaces:**
- Consumes: the isolated PostgreSQL closure fixture and real catalogue/API/web servers.
- Produces: browser evidence that a catalogue choice reaches the enabled booking form without weakening gates.

- [ ] **Step 1: Add the browser regression**

Seed the closure fixture with `experience: true`, visit a known published catalogue detail, click its variant action, assert the URL contains its project ID, and assert the matching quantity is `1`. Repeat automatically through the existing desktop and iPhone projects.

- [ ] **Step 2: Run the focused closure E2E**

Run: `pnpm test:e2e:closure -- --grep "catalogue choice"`

Expected: PASS in `chromium` and `mobile-chromium`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/live-ordinary-booking.spec.ts
git commit -m "test(booking): cover catalogue handoff"
```

### Task 5: Release verification and production deployment

**Files:**
- Modify only if verification exposes a requirement-related defect.

**Interfaces:**
- Consumes: all committed tasks and existing release scripts.
- Produces: a clean main branch, passing release evidence, and a verified live deployment.

- [ ] **Step 1: Run focused unit tests and typecheck**

Run:

```bash
pnpm --filter @yezz/web test -- components/catalogue/CatalogueDetail.test.tsx components/catalogue/CatalogueBookingLink.test.tsx components/book/OrdinaryBookingForm.test.tsx 'app/[locale]/projects/[slug]/page.test.tsx' 'app/[locale]/book/page.test.tsx'
pnpm typecheck
```

Expected: all pass.

- [ ] **Step 2: Run the full release verification**

Run: `pnpm verify:release`

Expected: typecheck, API tests, database tests, web tests, lint, builds, PostgreSQL closure, and desktop/mobile browser closure all pass.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff --check
git status --short
git log --oneline -6
```

Expected: no whitespace errors or unrelated changes.

- [ ] **Step 4: Push and verify production**

Push `main`, wait for the Vercel production bundle to contain the new bilingual booking action, and verify:

```text
experience = true
party = true
product = false
```

Also load the real English and Chinese catalogue detail and booking routes and confirm HTTP 200.

- [ ] **Step 5: Record completion**

Report changed behavior, test counts, deployment evidence, and any remaining work that truly requires YezYY content or credentials.
