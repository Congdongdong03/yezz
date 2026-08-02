# YezYY Studio Trust Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make YezYY feel like a real, bookable Glen Waverley studio before the new photo set arrives, with clear mobile actions and honest media placeholders that can be replaced through admin without another redesign.

**Architecture:** Keep booking and party availability server-authoritative. Extend the existing gallery taxonomy into reusable studio media slots, select those slots through one pure helper, and feed them into the existing server-rendered public pages. Add one client-side mobile action bar inside the shared public frame. Do not change booking capacity, payment, confirmation, or capability-gate logic in this phase.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, Tailwind CSS, Vitest, Testing Library, Playwright, Fastify API, Drizzle/PostgreSQL.

**Global Constraints:** English and Chinese public copy; admin remains Chinese; truthful fallbacks only; no fake testimonials or customer photos; no online payment language; party deposit is paid during a separate pre-party store visit; product/cart stays closed; experience and party requests stay open when server capabilities allow them.

---

### Task 1: Add stable studio media roles

**Files:**
- Create: `apps/web/lib/site/studio-media.ts`
- Create: `apps/web/lib/site/studio-media.test.ts`
- Modify: `apps/api/src/services/admin/gallery.admin.service.ts`
- Modify: `apps/api/src/services/admin/gallery.admin.service.test.ts`
- Modify: `apps/web/components/admin/GalleryForm.tsx`
- Modify: `apps/web/components/admin/GalleryForm.test.tsx`

**Step 1: Write the failing selector tests**

Cover `store`, `process`, `party`, `arrival`, `community`, and legacy categories. The selector must preserve sort order, reject blank URLs, and provide deterministic fallbacks without relabelling customer photos.

```ts
expect(selectStudioMedia(images).hero?._id).toBe("store-1");
expect(selectStudioMedia(images).arrival?._id).toBe("arrival-1");
expect(selectStudioMedia(images).party.map((image) => image._id)).toEqual(["party-1"]);
expect(selectStudioMedia(images).community).toEqual([]);
```

**Step 2: Run the focused tests and confirm failure**

Run: `pnpm --filter @yezz/web test --run lib/site/studio-media.test.ts`

Expected: FAIL because the selector does not exist.

**Step 3: Implement the pure selector**

Export a typed `selectStudioMedia(images)` result with `hero`, `store`, `process`, `party`, `arrival`, and `community`. A `store` image may be a hero fallback; an `arrival` image may fall back to `store`; community never falls back to other categories.

**Step 4: Expand allowed admin categories without breaking legacy data**

Preserve `couple`, `birthday`, `kids`, `gift`, `store`, and `works`; add `process`, `party`, `arrival`, and `community`. Show clear Chinese labels in admin rather than raw category names.

```ts
const CATEGORY_OPTIONS = [
  { value: "store", label: "门店环境" },
  { value: "arrival", label: "门店入口与到店指引" },
  { value: "process", label: "制作过程" },
  { value: "party", label: "派对场景" },
  { value: "community", label: "已授权顾客作品" },
  // legacy categories remain editable
];
```

**Step 5: Run focused API and web tests**

Run: `pnpm --filter @yezz/api test --run src/services/admin/gallery.admin.service.test.ts`

Run: `pnpm --filter @yezz/web test --run components/admin/GalleryForm.test.tsx lib/site/studio-media.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/services/admin/gallery.admin.service.ts apps/api/src/services/admin/gallery.admin.service.test.ts apps/web/components/admin/GalleryForm.tsx apps/web/components/admin/GalleryForm.test.tsx apps/web/lib/site/studio-media.ts apps/web/lib/site/studio-media.test.ts
git commit -m "feat: add studio media roles"
```

### Task 2: Add mobile-first booking actions to the shared public frame

**Files:**
- Create: `apps/web/components/public/MobileStudioActions.tsx`
- Create: `apps/web/components/public/MobileStudioActions.test.tsx`
- Modify: `apps/web/components/public/PublicMarketingFrame.tsx`
- Modify: `apps/web/components/public/PublicMarketingFrame.test.tsx`

**Step 1: Write failing action visibility tests**

Assert that mobile actions show `Book DIY`/`预约手作`, call, and directions; party-only mode links to parties; no request action is shown if both request capabilities are off; product capability never creates a mobile commerce action.

**Step 2: Run the focused tests and confirm failure**

Run: `pnpm --filter @yezz/web test --run components/public/MobileStudioActions.test.tsx components/public/PublicMarketingFrame.test.tsx`

Expected: FAIL because the mobile action component does not exist.

**Step 3: Implement the action bar**

Use the current locale, `YEZYY_BUSINESS_PROFILE`, localized routing, and existing capability object. Render only below the desktop breakpoint and add bottom padding to prevent content overlap.

```tsx
<nav aria-label={copy.actions} className="fixed inset-x-0 bottom-0 z-40 md:hidden">
  <Link href={primaryHref}>{copy.book}</Link>
  <a href={`tel:${formatPhoneHref(profile.phone)}`}>{copy.call}</a>
  <a href={profile.googleMapUrl} target="_blank" rel="noreferrer">{copy.directions}</a>
</nav>
```

**Step 4: Integrate into `PublicMarketingFrame`**

Keep the cart absent and pass the server-derived capabilities unchanged.

**Step 5: Run focused tests**

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web/components/public/MobileStudioActions.tsx apps/web/components/public/MobileStudioActions.test.tsx apps/web/components/public/PublicMarketingFrame.tsx apps/web/components/public/PublicMarketingFrame.test.tsx
git commit -m "feat: add mobile studio actions"
```

### Task 3: Wire real studio media into the homepage without inventing content

**Files:**
- Modify: `apps/web/lib/site/data.ts`
- Modify: `apps/web/lib/site/data.test.ts`
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: `apps/web/app/[locale]/page.test.tsx`
- Modify: `apps/web/components/sections/Hero.tsx`
- Modify: `apps/web/components/sections/BrandFallbacks.test.tsx`

**Step 1: Write failing data and page tests**

Assert that the first valid `store` image becomes the homepage hero only when `siteSettings.heroImageUrl` is absent. Assert that explicit settings always win and the truthful YezYY fallback remains when neither exists.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @yezz/web test --run lib/site/data.test.ts app/'[locale]'/page.test.tsx components/sections/BrandFallbacks.test.tsx`

Expected: FAIL on the new fallback behavior.

**Step 3: Use the centralized media selector in homepage data**

Do not duplicate category searches in page components. Pass the selected hero/store media through the existing `HomePageData` response.

**Step 4: Tighten hero image treatment**

Keep a strong readable overlay, accurate alt copy, a mobile-safe focal area, and current server-controlled request CTA. Do not show a false photo if no verified image exists.

**Step 5: Run focused tests**

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web/lib/site/data.ts apps/web/lib/site/data.test.ts apps/web/app/'[locale]'/page.tsx apps/web/app/'[locale]'/page.test.tsx apps/web/components/sections/Hero.tsx apps/web/components/sections/BrandFallbacks.test.tsx
git commit -m "feat: strengthen homepage studio proof"
```

### Task 4: Rebuild the gallery as a truthful studio diary

**Files:**
- Modify: `apps/web/components/gallery/EditorialGallery.tsx`
- Modify: `apps/web/components/gallery/EditorialGallery.test.tsx`
- Modify: `apps/web/app/[locale]/gallery/page.tsx`
- Modify: `apps/web/app/[locale]/gallery/page.test.tsx`

**Step 1: Write failing section tests**

Verify separate real sections for the studio, making process, parties, and consented community moments. Verify that missing sections show concise, honest copy and do not reuse inspiration images as customer evidence.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @yezz/web test --run components/gallery/EditorialGallery.test.tsx app/'[locale]'/gallery/page.test.tsx`

Expected: FAIL because the new media roles are not rendered.

**Step 3: Implement the editorial grid**

Use `selectStudioMedia`, varied aspect ratios, captions, responsive image sizes, and a quiet source/credit area for external editorial inspiration. Real studio media appears first. Community remains empty until `community` assets exist.

**Step 4: Run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/components/gallery/EditorialGallery.tsx apps/web/components/gallery/EditorialGallery.test.tsx apps/web/app/'[locale]'/gallery/page.tsx apps/web/app/'[locale]'/gallery/page.test.tsx
git commit -m "feat: rebuild studio gallery narrative"
```

### Task 5: Make arrival and contact details reduce staff questions

**Files:**
- Modify: `apps/web/components/visit/VisitStory.tsx`
- Modify: `apps/web/components/visit/VisitStory.test.tsx`
- Modify: `apps/web/app/[locale]/contact/page.tsx`
- Modify: `apps/web/app/[locale]/contact/page.test.tsx`

**Step 1: Write failing arrival tests**

Assert the page shows the exact address, current opening hours, phone, email, map action, and an arrival photo/instruction slot. If no arrival image exists, render a short text instruction and never a fake photograph.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @yezz/web test --run components/visit/VisitStory.test.tsx app/'[locale]'/contact/page.test.tsx`

Expected: FAIL on the arrival slot.

**Step 3: Implement arrival media and preparation copy**

Use `arrival` first and `store` only as the selector-approved fallback. Add bilingual guidance for in-store payment and staff confirmation without claiming a parking route or landmark that has not been supplied.

**Step 4: Run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/components/visit/VisitStory.tsx apps/web/components/visit/VisitStory.test.tsx apps/web/app/'[locale]'/contact/page.tsx apps/web/app/'[locale]'/contact/page.test.tsx
git commit -m "feat: improve visit and arrival guidance"
```

### Task 6: Add party proof and a question-reducing FAQ

**Files:**
- Create: `apps/web/components/parties/PartyFAQ.tsx`
- Create: `apps/web/components/parties/PartyFAQ.test.tsx`
- Modify: `apps/web/app/[locale]/parties/page.tsx`
- Modify: `apps/web/app/[locale]/parties/page.test.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Step 1: Write failing copy and behavior tests**

Cover 4–8 guests, age 5+, 1–2 supervising parents, A$45 minimum DIY spend per guest, BYO food/drinks/cake, A$95/A$145 venue fee and deposit, separate pre-party in-store payment, staff-controlled payment deadline, manual confirmation, and no online payment claim.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @yezz/web test --run components/parties/PartyFAQ.test.tsx app/'[locale]'/parties/page.test.tsx`

Expected: FAIL because the FAQ and refined deposit wording do not exist.

**Step 3: Implement the FAQ and optional party media**

Load gallery media alongside packages/settings. Use a verified `party` image when available; otherwise preserve the designed rose panel. Keep the request CTA governed only by server capability plus the complete verified package catalogue.

**Step 4: Run focused tests**

Expected: PASS in English and Chinese.

**Step 5: Commit**

```bash
git add apps/web/components/parties/PartyFAQ.tsx apps/web/components/parties/PartyFAQ.test.tsx apps/web/app/'[locale]'/parties/page.tsx apps/web/app/'[locale]'/parties/page.test.tsx apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: add party trust and faq content"
```

### Task 7: Verify the trust-layer release candidate

**Files:**
- Modify as needed: `apps/web/e2e/public-trust-layer.spec.ts`
- Modify as needed: `docs/production-release-checklist.md`

**Step 1: Add one focused browser journey**

At desktop and mobile widths, cover homepage → project/book action, gallery, contact/map, parties/request action, and confirm product/cart remains unavailable.

**Step 2: Run targeted checks**

Run the focused Vitest files from Tasks 1–6, then:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter @yezz/web test:e2e -- public-trust-layer.spec.ts
```

Expected: all PASS.

**Step 3: Run full release verification**

Run: `pnpm verify:release`

Expected: PASS, including database-backed booking closure tests.

**Step 4: Visually inspect real routes**

Check `/en`, `/zh`, `/en/gallery`, `/zh/gallery`, `/en/contact`, `/zh/contact`, `/en/parties`, and `/zh/parties` at 390px and desktop widths. Confirm the sticky action bar does not cover forms or footer content.

**Step 5: Request independent code review**

Review capability-gate preservation, truthful media semantics, bilingual accuracy, image performance, and mobile accessibility. Resolve Important findings before integration.

**Step 6: Commit final test/checklist adjustments**

```bash
git add apps/web/e2e/public-trust-layer.spec.ts docs/production-release-checklist.md
git commit -m "test: verify studio trust layer"
```

## Follow-on plans

After this plan passes, create and execute two separate plans:

1. `2026-08-03-yezyy-four-step-booking.md` — category/project, party size, date/time, contact/terms; touched-only validation; sticky summary; deep-link preselection; in-store decision option; complete success page.
2. `2026-08-03-yezyy-business-safety-growth.md` — bilingual privacy and booking/party terms, consent records, footer legal identity slot, GA4/Search Console configuration, Sentry/uptime/email-failure monitoring, and backup checks. Policy text is an operational draft pending Australian professional review.
