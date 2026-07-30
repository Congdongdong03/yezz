# YezYY Editorial Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make the public YezYY site feel like a real, established DIY studio through truthful editorial imagery, stronger page composition, and deliberate mobile layouts, without changing operational flows.

**Architecture:** API-provided projects, gallery entries, parties, and settings remain the source of truth. A web-only editorial-media registry holds the small set of generic licensed inspiration assets; focused presentation components show provenance wherever a visitor could otherwise mistake them for real YezYY work. Public routes consume these components without modifying API models, booking mutations, capability evaluation, or Chinese admin routes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, next-intl, next/image, Framer Motion, Vitest, Playwright.

## Global Constraints

- Keep all three public request capabilities false throughout development and release verification.
- Keep booking, party, customer-management, and Chinese admin behaviour unchanged.
- Use real YezYY photos only for claims about YezYY premises, people, events, or customer work.
- Use licensed generic imagery only as explicitly labelled DIY/project inspiration; record source and license in code.
- Do not introduce online payment, product checkout, or any request-gate bypass.
- Preserve English and Simplified Chinese content, keyboard focus, semantic headings, and reduced-motion behaviour.
- Use the existing warm canvas, paper, blush, rose paper, footer rose, brand pink, warm ink, and muted-text public tokens. Do not add a large near-black public surface.

---

## File Structure

- Create apps/web/lib/editorial/media.ts: typed generic-inspiration registry, sources, licence labels, alt text, intended placements.
- Create apps/web/components/public/ImageProvenance.tsx: bilingual disclosure for non-YezYY inspiration media.
- Create apps/web/components/public/EditorialImage.tsx: image wrapper with truthful alternate text and provenance disclosure.
- Create apps/web/components/sections/StudioConfidenceStrip.tsx: compact operational facts below the homepage hero.
- Create apps/web/components/sections/StudioProcess.tsx: rose-paper making-process split section.
- Create apps/web/components/sections/EditorialProjects.tsx: asymmetric home project cluster.
- Create apps/web/components/sections/StudioVisitPreview.tsx: real-store-image-led Visit preview.
- Create apps/web/components/gallery/EditorialGallery.tsx: grouped responsive gallery mosaic.
- Create apps/web/components/visit/VisitStory.tsx: Visit-page image/facts/map composition.
- Modify public routes, current public sections, messages, image configuration, focused tests, E2E closure tests, and production checklist.

## Task 1: Build the truthful generic-image boundary

**Files:**
- Create: apps/web/lib/editorial/media.ts
- Create: apps/web/lib/editorial/media.test.ts
- Create: apps/web/components/public/ImageProvenance.tsx
- Create: apps/web/components/public/ImageProvenance.test.tsx
- Create: apps/web/components/public/EditorialImage.tsx
- Modify: apps/web/next.config.ts
- Modify: apps/web/lib/i18n/messages/en.json
- Modify: apps/web/lib/i18n/messages/zh.json

**Interfaces:**
- Consumes: Next image remote-pattern configuration and locale en or zh.
- Produces: EditorialMedia, EDITORIAL_MEDIA, getEditorialMedia, ImageProvenance, and EditorialImage.

- [ ] **Step 1: Write failing registry and disclosure tests**

~~~tsx
it("records a source and license for every generic asset", () => {
  expect(EDITORIAL_MEDIA).not.toHaveLength(0);
  for (const item of EDITORIAL_MEDIA) {
    expect(item.kind).toBe("inspiration");
    expect(item.sourceUrl).toMatch(/^https:\/\//);
    expect(item.licenseLabel.en.length).toBeGreaterThan(0);
    expect(item.licenseLabel.zh.length).toBeGreaterThan(0);
  }
});

it("does not describe inspiration as YezYY customer work", () => {
  const html = renderToStaticMarkup(
    <ImageProvenance locale="en" kind="inspiration" sourceUrl="https://example.com" />,
  );
  expect(html).toContain("DIY inspiration");
  expect(html).not.toContain("YezYY customer work");
});
~~~

- [ ] **Step 2: Run the focused tests to confirm the modules are absent**

Run: corepack pnpm --filter @yezz/web test -- apps/web/lib/editorial/media.test.ts apps/web/components/public/ImageProvenance.test.tsx

Expected: FAIL because the registry and disclosure components do not exist.

- [ ] **Step 3: Add the typed registry and the two presentation components**

~~~ts
export type EditorialMedia = {
  id: "cream-piping" | "beading" | "paint-figurine";
  kind: "inspiration";
  imageUrl: string;
  sourceUrl: string;
  licenseLabel: { en: string; zh: string };
  alt: { en: string; zh: string };
  placements: Array<"home-process" | "gallery-inspiration" | "project-detail">;
};

export function getEditorialMedia(id: EditorialMedia["id"]): EditorialMedia {
  const media = EDITORIAL_MEDIA.find((item) => item.id === id);
  if (!media) throw new Error("Unknown editorial media");
  return media;
}
~~~

Only permit image source hosts that appear in next.config.ts. ImageProvenance renders locale-specific DIY inspiration text and a source link. EditorialImage passes truthful alternate text to next/image and renders provenance only for inspiration assets.

- [ ] **Step 4: Run focused tests and TypeScript**

Run: corepack pnpm --filter @yezz/web test -- apps/web/lib/editorial/media.test.ts apps/web/components/public/ImageProvenance.test.tsx && corepack pnpm --filter @yezz/web typecheck

Expected: focused tests and TypeScript pass.

- [ ] **Step 5: Commit the media boundary**

Run: git add apps/web/lib/editorial apps/web/components/public/ImageProvenance.tsx apps/web/components/public/ImageProvenance.test.tsx apps/web/components/public/EditorialImage.tsx apps/web/next.config.ts apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json && git commit -m "feat(public): add disclosed editorial media"

## Task 2: Recompose the homepage as a studio visit

**Files:**
- Create: apps/web/components/sections/StudioConfidenceStrip.tsx and test
- Create: apps/web/components/sections/StudioProcess.tsx and test
- Create: apps/web/components/sections/EditorialProjects.tsx and test
- Create: apps/web/components/sections/StudioVisitPreview.tsx
- Modify: apps/web/components/sections/Hero.tsx
- Modify: apps/web/app/[locale]/page.tsx
- Modify: apps/web/app/globals.css

**Interfaces:**
- Consumes: HomePageData, EditorialImage, public capability booleans, and next-intl messages.
- Produces: hero, confidence facts, projects, process, party, gallery, and Visit narrative.

- [ ] **Step 1: Write failing section tests**

~~~tsx
it("keeps the browse-projects fallback while requests are closed", () => {
  const html = renderToStaticMarkup(<Hero experienceEnabled={false} />);
  expect(html).toContain('href="/projects"');
  expect(html).not.toContain('href="/book"');
});

it("discloses generic process imagery as inspiration", () => {
  const html = renderToStaticMarkup(<StudioProcess locale="en" />);
  expect(html).toContain("DIY inspiration");
});

it("renders operational facts as a compact list", () => {
  const html = renderToStaticMarkup(<StudioConfidenceStrip locale="en" />);
  expect(html).toContain("Beginner friendly");
  expect(html).toContain("Pay in store");
});
~~~

- [ ] **Step 2: Run these tests before the new sections exist**

Run: corepack pnpm --filter @yezz/web test -- apps/web/components/sections/StudioConfidenceStrip.test.tsx apps/web/components/sections/StudioProcess.test.tsx apps/web/components/sections/EditorialProjects.test.tsx

Expected: FAIL with module-resolution errors for the new components.

- [ ] **Step 3: Implement the composed homepage**

Render this sequence in the homepage route: Hero, StudioConfidenceStrip, EditorialProjects with three API projects, StudioProcess, the existing party preview, GalleryHighlight, and StudioVisitPreview. Replace SceneEntry and WhyDIY rather than adding more equal-weight modules. On desktop, EditorialProjects has one large tile and two supporting tiles; on mobile it becomes a natural one-column order. StudioVisitPreview retains the existing honest missing-store fallback.

- [ ] **Step 4: Run focused tests and the full web suite**

Run: corepack pnpm --filter @yezz/web test -- apps/web/components/sections/BrandFallbacks.test.tsx apps/web/components/sections/StudioConfidenceStrip.test.tsx apps/web/components/sections/StudioProcess.test.tsx apps/web/components/sections/EditorialProjects.test.tsx && corepack pnpm --filter @yezz/web test

Expected: all focused and existing web tests pass.

- [ ] **Step 5: Commit homepage composition**

Run: git add apps/web/components/sections apps/web/app/[locale]/page.tsx apps/web/app/globals.css && git commit -m "feat(public): compose editorial studio homepage"

## Task 3: Build a truthful editorial gallery and Visit page

**Files:**
- Create: apps/web/components/gallery/EditorialGallery.tsx and test
- Create: apps/web/components/visit/VisitStory.tsx and test
- Modify: apps/web/app/[locale]/gallery/page.tsx and test
- Modify: apps/web/app/[locale]/contact/page.tsx and test

**Interfaces:**
- Consumes: API gallery records, editorial media registry, business profile, site settings, and business-hours formatter.
- Produces: grouped gallery content and a Visit page that only identifies API store media as real YezYY imagery.

- [ ] **Step 1: Write failing gallery and Visit tests**

~~~tsx
it("separates verified YezYY images from generic inspiration", () => {
  const html = renderToStaticMarkup(
    <EditorialGallery locale="en" images={[{ _id: "store-1", imageUrl: "/store.jpg", category: "store" }]} />,
  );
  expect(html).toContain("At YezYY");
  expect(html).toContain("DIY inspiration");
  expect(html).toContain("Community moments");
});

it("keeps a future-community empty state", () => {
  const html = renderToStaticMarkup(<EditorialGallery locale="en" images={[]} />);
  expect(html).toContain("Customer moments will appear here");
});

it("renders the exact studio address and map action", () => {
  const html = renderToStaticMarkup(<VisitStory locale="en" settings={null} />);
  expect(html).toContain("G082/235 Springvale Rd, Glen Waverley VIC 3150");
  expect(html).toContain("Open in Google Maps");
});
~~~

- [ ] **Step 2: Run focused gallery and Visit tests**

Run: corepack pnpm --filter @yezz/web test -- apps/web/components/gallery/EditorialGallery.test.tsx apps/web/components/visit/VisitStory.test.tsx

Expected: FAIL because the new route components do not exist.

- [ ] **Step 3: Implement the mosaic and Visit composition**

EditorialGallery filters API category store into the real At YezYY group, renders registry assets only under DIY inspiration, and renders Community moments as text-only until consented customer media exists. VisitStory uses a real store image only if an API store image exists, preserves address, phone, email, opening hours, WeChat/Xiaohongshu, and the existing Google Maps URL, and does not claim parking or transit facts that are not in business data.

- [ ] **Step 4: Run focused and existing route tests**

Run: corepack pnpm --filter @yezz/web test -- apps/web/components/gallery/EditorialGallery.test.tsx apps/web/components/visit/VisitStory.test.tsx apps/web/app/[locale]/gallery/page.test.tsx apps/web/app/[locale]/contact/page.test.tsx

Expected: all gallery and Visit tests pass.

- [ ] **Step 5: Commit gallery and Visit**

Run: git add apps/web/components/gallery apps/web/components/visit apps/web/app/[locale]/gallery apps/web/app/[locale]/contact && git commit -m "feat(public): add truthful gallery and visit stories"

## Task 4: Extend editorial language to projects and parties

**Files:**
- Modify: apps/web/components/projects/ProjectCard.tsx
- Modify: apps/web/components/projects/ProjectDetail.tsx
- Modify: apps/web/app/[locale]/projects/page.tsx
- Modify: apps/web/app/[locale]/parties/page.tsx
- Modify: apps/web/components/parties/PartyInquiryCTA.tsx
- Modify: project detail and party route tests

**Interfaces:**
- Consumes: existing project and party API mappings, shared public tokens, and request capability props.
- Produces: image-led catalogue/detail surfaces that preserve closed-flow CTA routing and business facts.

- [ ] **Step 1: Add focused behaviour assertions**

~~~tsx
it("keeps the closed project request fallback instead of booking", () => {
  const html = renderToStaticMarkup(<ProjectDetail project={project} locale="en" requestEnabled={false} />);
  expect(html).toContain("contact");
  expect(html).not.toContain('href="/book"');
});

it("keeps party capacity and pay-in-store policy visible", async () => {
  const html = renderToStaticMarkup(await PartiesPage({ params: Promise.resolve({ locale: "en" }) }));
  expect(html).toContain("4–8");
  expect(html).toContain("Pay in store");
});
~~~

- [ ] **Step 2: Run project and party tests before visual markup changes**

Run: corepack pnpm --filter @yezz/web test -- apps/web/components/projects/ProjectDetail.test.tsx apps/web/app/[locale]/parties/page.test.tsx

Expected: current behaviour passes; add a semantic or class assertion that fails for the intended fact-rail structure before implementation.

- [ ] **Step 3: Implement fact rails and image hierarchy**

Use a compact definition-list fact rail for project price, duration, and tags while preserving locale formatters. Make the first catalogue project dominant on large screens without changing project links. Use a restrained party header split and retain manual confirmation, pay in store, parent supervision, 4–8 participant, and closed-entry text in accessible content.

- [ ] **Step 4: Run component and route tests**

Run: corepack pnpm --filter @yezz/web test -- apps/web/components/projects/ProjectDetail.test.tsx apps/web/app/[locale]/parties/page.test.tsx apps/web/components/parties/PartyInquiryCTA.test.tsx

Expected: all pass; no booking or party mutation appears when gates are false.

- [ ] **Step 5: Commit project and party refinements**

Run: git add apps/web/components/projects apps/web/components/parties apps/web/app/[locale]/projects apps/web/app/[locale]/parties && git commit -m "style(public): refine editorial project and party surfaces"

## Task 5: Complete real viewport validation and release checks

**Files:**
- Modify: apps/web/e2e/experience-closure.spec.ts
- Modify: apps/web/e2e/party-closure.spec.ts
- Modify: apps/web/e2e/product-closure.spec.ts
- Modify: docs/PRODUCTION-CHECKLIST.md

**Interfaces:**
- Consumes: deployed site URLs, closure UI fixture, capability endpoint, and public routes.
- Produces: release evidence that the visual update retains closed gates at desktop and 390 by 844 mobile viewport sizes.

- [ ] **Step 1: Add a failing mobile closed-gate E2E assertion**

~~~ts
test("marketing pages keep request gates closed on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/parties");
  await expect(page.getByRole("link", { name: /browse projects/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /book now/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /cart/i })).toHaveCount(0);
});
~~~

- [ ] **Step 2: Run the selected closure test**

Run: corepack pnpm --filter @yezz/web test:e2e -- e2e/experience-closure.spec.ts

Expected: FAIL only until the test uses the established closure-ui fixture and public URL helper.

- [ ] **Step 3: Adapt the test to the existing closure fixture and update the checklist**

Use closure-ui, not a new API bypass. Keep all capability values false. Document actual visual checks at 1440 by 900 and 390 by 844 for English and Chinese home, projects, parties, gallery, and Visit routes.

- [ ] **Step 4: Run full verification and browser review**

Run: corepack pnpm verify:release

Expected: typechecks, unit tests, build, closure tests, and release checks pass. Then use the in-app browser to inspect the listed routes at desktop and narrow mobile sizes and record browser evidence separately from test output.

- [ ] **Step 5: Commit verification evidence**

Run: git add apps/web/e2e/experience-closure.spec.ts apps/web/e2e/party-closure.spec.ts apps/web/e2e/product-closure.spec.ts docs/PRODUCTION-CHECKLIST.md && git commit -m "test(public): verify editorial release gates"

## Plan Self-Review

- Task 1 implements image provenance, Task 2 completes the home visit narrative, Task 3 covers gallery and Visit, Task 4 handles project and party presentation, and Task 5 validates desktop/mobile plus all closed gates.
- The plan excludes database, API, payment, admin, and booking-policy changes.
- Every new generic image uses the same EditorialMedia contract and every visual action keeps the existing capability decision.
- Each task has test-first work, focused validation, and an isolated commit.
