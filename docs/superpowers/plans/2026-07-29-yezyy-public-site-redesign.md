# YezYY Public Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the bilingual YezYY public site into a mature, image-led DIY studio experience while preserving server-authoritative booking rules and keeping experience, party, and product request entry points closed until a later explicit launch decision.

**Architecture:** The redesign adds a public-only visual shell and small, typed presentation components around the existing Next.js App Router data and booking boundaries. Public routes consume normalized API views and a checked-in licensed-media manifest; capability-gated actions never infer business rules or bypass the API. Admin routes retain their existing operational shell and are not coupled to public theme tokens.

**Tech Stack:** Next.js 16.1.7 App Router, React 19.2.4, TypeScript, next-intl 4.12, Tailwind CSS 4, Framer Motion 12, Vitest 4, React Testing Library, Playwright 1.61.

## Global Constraints

- Use the exact public brand `YezYY`; never publish `YEZZ`, `Yezz`, or `Yez YY`.
- Use English and Simplified Chinese public copy; the admin remains Chinese and operational.
- Use the approved palette: `#FBF8F6`, `#FFFFFF`, `#F8E8EE`, `#F2DFE6`, `#E5C8D3`, `#D96F9E`, `#44393D`, `#75666B`, and `#E8DEDF`.
- Do not use a large near-black surface. Dark colour is limited to readable text and small outlines.
- Keep `REQUEST_FLOW_EXPERIENCE_ENABLED=false`, `REQUEST_FLOW_PARTY_ENABLED=false`, and `REQUEST_FLOW_PRODUCT_ENABLED=false` through implementation and deployment verification.
- A public action requires both the environment hard gate and the database capability to be enabled by the existing backend settings response.
- Product, cart, and checkout entry points remain hidden while the product capability is false.
- The public site must never imply that a request is confirmed; YezYY confirms manually and customers pay in store in AUD.
- Capacity, lead time, horizon, duration, payment, refund, cancellation, rescheduling, and status-transition validation remain server authoritative.
- Use verified YezYY photography for the premises, actual projects, events, customer work, prices, and results.
- External imagery is limited to generic painted-plaster, bracelet-beading, and air-dry-cream-piping inspiration or making process. Each source must explicitly grant commercial reuse.
- Do not copy images, copy, or visual assets from UnicDIY or another studio.
- Do not present licensed generic imagery as a YezYY customer, class, result, price, inclusion, or finished-work gallery entry.
- Preserve a source-page URL, creator, licence, licence URL, download date, local path, and approved use for every external image.
- Do not publish identifiable children without guardian consent or identifiable adults without consent.
- Use `next/image` with explicit `sizes`, meaningful localized alternative text, and crop focal points.
- Meet keyboard, visible-focus, semantic heading, contrast, reduced-motion, and 320px mobile requirements.
- Do not add runtime packages and do not run `pnpm install`.
- The owner must review the legal drafts and provide the registered business name before legal pages are enabled in production navigation.

---

## File and Interface Map

The implementation creates these focused public units:

- `apps/web/components/public/PublicHeader.tsx`: desktop header, locale switch, capability-safe primary action.
- `apps/web/components/public/PublicMobileMenu.tsx`: focus-trapped mobile navigation with no cart when product is disabled.
- `apps/web/components/public/PublicFooter.tsx`: rose-paper footer, visit details, verified social links, policy links.
- `apps/web/components/public/RequestAction.tsx`: single capability-aware link/fallback contract shared by public pages.
- `apps/web/components/public/ProjectFacts.tsx`: price, duration, age, and attendance facts without business-rule inference.
- `apps/web/components/sections/HeroCarousel.tsx`: one-to-three slide hero with seven-second rotation and reduced-motion behavior.
- `apps/web/components/sections/ConfidenceStrip.tsx`: four operational truths.
- `apps/web/components/sections/FeaturedActivityGrid.tsx`: exactly three slug-selected signature activities.
- `apps/web/components/sections/HowItWorks.tsx`: request, manual confirmation, and pay-in-store process.
- `apps/web/components/sections/StudioStory.tsx`: real YezYY studio story.
- `apps/web/components/sections/PartyStory.tsx`: factual party invitation.
- `apps/web/components/sections/InStoreDiscovery.tsx`: retail discovery without shopping actions.
- `apps/web/components/sections/VisitPanel.tsx`: address, hours, contact, directions, and storefront.
- `apps/web/content/public-media.json`: auditable media records.
- `apps/web/lib/site/public-media.ts`: typed manifest validation and localized presentation mapping.
- `apps/web/public/media/yezyy/*`: publication-ready YezYY-owned images.
- `apps/web/public/media/licensed/*`: downloaded, optimized external images whose manifest records remain checked in.

The public shell consumes the existing `SiteSettingsView["requestCapabilities"]`. The booking, waitlist, party, and customer-management components keep their existing API contracts.

---

### Task 1: Public Visual Foundation, Navigation, and Capability-Safe Actions

**Files:**
- Create: `apps/web/components/public/RequestAction.tsx`
- Create: `apps/web/components/public/RequestAction.test.tsx`
- Create: `apps/web/components/public/PublicHeader.tsx`
- Create: `apps/web/components/public/PublicHeader.test.tsx`
- Create: `apps/web/components/public/PublicMobileMenu.tsx`
- Create: `apps/web/components/public/PublicFooter.tsx`
- Create: `apps/web/components/public/PublicFooter.test.tsx`
- Create: `apps/web/components/analytics/GoogleAnalytics.test.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/[locale]/layout.tsx`
- Modify: `apps/web/components/analytics/GoogleAnalytics.tsx`
- Modify: `apps/web/lib/analytics/gtag.ts`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`
- Delete after replacements pass: `apps/web/components/layout/Navbar.tsx`
- Delete after replacements pass: `apps/web/components/layout/MobileMenu.tsx`
- Delete after replacements pass: `apps/web/components/layout/BookNavButton.tsx`
- Delete after replacements pass: `apps/web/components/layout/Footer.tsx`
- Delete after replacements pass: `apps/web/components/layout/Footer.test.tsx`

**Interfaces:**
- Consumes: `SiteSettingsView["requestCapabilities"]` from `apps/web/lib/site/data.ts`.
- Produces:

```ts
export type PublicCapability = "experience" | "party" | "product";

export type RequestActionProps = {
  capability: PublicCapability;
  enabled: boolean;
  enabledHref: "/book" | "/parties" | "/cart";
  disabledHref: "/projects" | "/contact";
  enabledLabel: string;
  disabledLabel: string;
  className?: string;
};

export type PublicShellProps = {
  capabilities: SiteSettingsView["requestCapabilities"];
  settings?: SiteSettingsView | null;
};
```

- `RequestAction` renders a normal localized `Link`; it performs no mutation.
- `PublicHeader` and `PublicMobileMenu` expose cart UI only when `capabilities.product === true`.
- The experience action routes to `/book` only when `capabilities.experience === true`; otherwise it routes to `/projects` with truthful browse copy.

- [ ] **Step 1: Write failing capability and shell tests**

```tsx
it("routes the disabled experience action to browsing, not booking", () => {
  const html = renderToStaticMarkup(
    <RequestAction
      capability="experience"
      enabled={false}
      enabledHref="/book"
      disabledHref="/projects"
      enabledLabel="Request a session"
      disabledLabel="Explore DIY projects"
    />,
  );
  expect(html).toContain('href="/projects"');
  expect(html).not.toContain('href="/book"');
});

it("hides every cart entry while product requests are disabled", () => {
  const html = renderToStaticMarkup(
    <PublicHeader
      capabilities={{ experience: false, party: false, product: false }}
    />,
  );
  expect(html).not.toContain("/cart");
  expect(html).not.toContain("Shopping bag");
});

it("renders the approved rose footer without a dark surface", () => {
  const html = renderToStaticMarkup(
    <PublicFooter
      capabilities={{ experience: false, party: false, product: false }}
    />,
  );
  expect(html).toContain("bg-[var(--public-footer)]");
  expect(html).not.toContain("bg-warm-charcoal");
  expect(html).toContain("G082/235 Springvale Rd");
});

it.each([
  "/admin",
  "/admin/bookings",
  "/en/manage-booking/private-token",
  "/zh/manage-booking/private-token",
])("does not load analytics on a private path: %s", (pathname) => {
  expect(isAnalyticsPathAllowed(pathname)).toBe(false);
});

it("allows analytics only on ordinary public pages", () => {
  expect(isAnalyticsPathAllowed("/en/projects")).toBe(true);
  expect(isAnalyticsPathAllowed("/zh/contact")).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests and verify the missing modules fail**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/public/RequestAction.test.tsx components/public/PublicHeader.test.tsx components/public/PublicFooter.test.tsx
```

Expected: FAIL because `RequestAction`, `PublicHeader`, and `PublicFooter` do not exist.

- [ ] **Step 3: Add public-only tokens without changing admin tokens**

Add a `.public-site` scope in `globals.css`:

```css
.public-site {
  --public-canvas: #FBF8F6;
  --public-paper: #FFFFFF;
  --public-blush: #F8E8EE;
  --public-rose-paper: #F2DFE6;
  --public-footer: #E5C8D3;
  --public-pink: #D96F9E;
  --public-ink: #44393D;
  --public-muted: #75666B;
  --public-border: #E8DEDF;
  min-width: 0;
  background: var(--public-canvas);
  color: var(--public-ink);
}

.public-site :focus-visible {
  outline: 3px solid color-mix(in srgb, var(--public-pink) 70%, white);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .public-site *,
  .public-site *::before,
  .public-site *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Do not replace `:root`, `.dark`, or the admin sidebar variables in this task.

- [ ] **Step 4: Implement the capability-safe action and public shell**

Implement `RequestAction` as:

```tsx
export default function RequestAction(props: RequestActionProps) {
  const href = props.enabled ? props.enabledHref : props.disabledHref;
  const label = props.enabled ? props.enabledLabel : props.disabledLabel;
  return (
    <Link className={props.className} href={href}>
      {label}
    </Link>
  );
}
```

Build the header with nav labels `DIY Projects`, `Parties`, `Gallery`, and `Visit`; keep the route `/contact`. Pass `capabilities` to both desktop and mobile versions. Preserve the existing mobile focus trap, Escape handling, focus restoration, and `aria-modal`.

Build the footer with:

- exact business name, address, phone, email, and Xiaohongshu account;
- Instagram only when `settings.instagram` is an absolute HTTP(S) URL;
- `bg-[var(--public-footer)] text-[var(--public-ink)]`;
- no cart entry and no dark full-width surface.

Task 1 does not link policy drafts. Task 8 adds the routes and keeps their footer
links behind the explicit policy-review gate.

Change the locale layout to:

```tsx
<CartProvider>
  <div className="public-site flex min-h-screen flex-col">
    <PublicHeader capabilities={siteSettings.requestCapabilities} />
    <main className="min-w-0 flex-1">
      <ErrorBoundary>{children}</ErrorBoundary>
    </main>
    <PublicFooter
      capabilities={siteSettings.requestCapabilities}
      settings={siteSettings}
    />
    {siteSettings.requestCapabilities.product && <CartDrawer />}
    {siteSettings.requestCapabilities.product && <CartToast />}
  </div>
</CartProvider>
```

The `CartProvider` remains because project components currently consume its context; disabling product removes public cart UI, not the safe provider.

- [ ] **Step 5: Prevent analytics from receiving private route paths**

Export and test:

```ts
export function isAnalyticsPathAllowed(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
  return !/^\/(?:en|zh)\/manage-booking(?:\/|$)/.test(pathname);
}
```

Make `GoogleAnalytics` a pathname-aware client component. Return `null` before
rendering either `next/script` element when the path is disallowed. Configure
GA with `send_page_view: false`, then send a page view only for the allowed
locale pathname. Do not include query strings, fragments, booking tokens,
admin paths, email addresses, or form field values in analytics events.

- [ ] **Step 6: Add exact bilingual navigation and action copy**

Add message keys with these meanings:

```json
{
  "nav": {
    "projects": "DIY Projects",
    "parties": "Parties",
    "gallery": "Gallery",
    "contact": "Visit",
    "book": "Request a session",
    "browseProjects": "Explore DIY projects"
  }
}
```

Chinese:

```json
{
  "nav": {
    "projects": "手作项目",
    "parties": "派对",
    "gallery": "作品与空间",
    "contact": "到店信息",
    "book": "提交预约申请",
    "browseProjects": "查看手作项目"
  }
}
```

Merge these keys into the existing namespaces rather than replacing unrelated translations.

- [ ] **Step 7: Run focused tests, public/admin type checks, and lint**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/public/RequestAction.test.tsx components/public/PublicHeader.test.tsx components/public/PublicFooter.test.tsx components/analytics/GoogleAnalytics.test.tsx
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint app/layout.tsx 'app/[locale]/layout.tsx' components/public components/analytics/GoogleAnalytics.tsx lib/analytics/gtag.ts
```

Expected: all tests PASS, TypeScript exits 0, ESLint exits 0. Open `/admin/bookings` locally and confirm the public rose tokens do not appear on the admin shell.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx 'apps/web/app/[locale]/layout.tsx' apps/web/components/public apps/web/components/layout apps/web/components/analytics/GoogleAnalytics.tsx apps/web/components/analytics/GoogleAnalytics.test.tsx apps/web/lib/analytics/gtag.ts apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: add YezYY public visual shell"
```

---

### Task 2: Licensed Media Manifest, Storefront Asset, and Hero Carousel

**Files:**
- Create: `apps/web/content/public-media.json`
- Create: `apps/web/lib/site/public-media.ts`
- Create: `apps/web/lib/site/public-media.test.ts`
- Create: `apps/web/components/sections/HeroCarousel.tsx`
- Create: `apps/web/components/sections/HeroCarousel.test.tsx`
- Create: `apps/web/public/media/yezyy/storefront.jpg`
- Create as suitable licensed originals are verified: `apps/web/public/media/licensed/painted-plaster.jpg`
- Create as suitable licensed originals are verified: `apps/web/public/media/licensed/bracelet-beading.jpg`
- Create as suitable licensed originals are verified: `apps/web/public/media/licensed/cream-piping.jpg`
- Modify: `apps/web/lib/site/data.ts`
- Modify: `apps/web/next.config.ts`
- Delete after replacement passes: `apps/web/components/sections/Hero.tsx`
- Modify: `apps/web/components/sections/BrandFallbacks.test.tsx`

**Interfaces:**
- Produces:

```ts
export type PublicMediaRecord = {
  id: string;
  localPath: `/media/${string}`;
  width: number;
  height: number;
  ownership: "yezyy-owned" | "licensed-generic";
  subject:
    | "storefront"
    | "studio"
    | "making-process"
    | "painted-plaster"
    | "bracelet-beading"
    | "cream-piping";
  sourcePageUrl: string;
  creator: string;
  licenseName: string;
  licenseUrl: string;
  downloadedOn: `${number}-${number}-${number}`;
  approvedUse: "identity" | "hero-process" | "category-inspiration";
  alt: { en: string; zh: string };
  disclosure?: { en: string; zh: string };
  focalPoint: `${number}% ${number}%`;
};

export type HeroSlide = Pick<
  PublicMediaRecord,
  "id" | "localPath" | "ownership" | "alt" | "disclosure" | "focalPoint"
>;

export function getPublicMedia(id: string): PublicMediaRecord;
export function listPublicMedia(): PublicMediaRecord[];
export function getHeroSlides(): HeroSlide[];
```

- `HeroCarousel` accepts:

```ts
type HeroCarouselProps = {
  slides: HeroSlide[];
  locale: "en" | "zh";
  experienceEnabled: boolean;
  partyEnabled: boolean;
};
```

- It rotates every `7000` milliseconds only when there are at least two slides and reduced motion is not requested.
- One slide is static. No image is duplicated to create a larger slide set.

- [ ] **Step 1: Write failing manifest and carousel tests**

```ts
it("requires a commercial-use licence for generic media", () => {
  for (const item of listPublicMedia()) {
    if (item.ownership !== "licensed-generic") continue;
    expect(item.sourcePageUrl).toMatch(/^https:\/\//);
    expect(item.licenseUrl).toMatch(/^https:\/\//);
    expect(item.creator.trim().length).toBeGreaterThan(0);
    expect(item.disclosure?.en).toBe("Inspiration image");
    expect(item.disclosure?.zh).toBe("灵感示意图");
  }
});

it("never classifies generic media as identity or gallery content", () => {
  for (const item of listPublicMedia()) {
    if (item.ownership === "licensed-generic") {
      expect(item.approvedUse).not.toBe("identity");
    }
  }
});
```

```tsx
it("renders one image without carousel controls or duplicated slides", () => {
  render(<HeroCarousel slides={[storefront]} locale="en" experienceEnabled={false} partyEnabled={false} />);
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(screen.queryByLabelText("Next slide")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Explore DIY projects" })).toHaveAttribute("href", "/projects");
});

it("advances three slides after seven seconds and pauses on user request", async () => {
  vi.useFakeTimers();
  render(<HeroCarousel slides={slides} locale="en" experienceEnabled partyEnabled />);
  await act(() => vi.advanceTimersByTimeAsync(7000));
  expect(screen.getByText("Slide 2 of 3")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
  await act(() => vi.advanceTimersByTimeAsync(7000));
  expect(screen.getByText("Slide 2 of 3")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify missing media modules fail**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run lib/site/public-media.test.ts components/sections/HeroCarousel.test.tsx
```

Expected: FAIL because the manifest mapper and carousel do not exist.

- [ ] **Step 3: Prepare the verified YezYY storefront asset**

Use the owner-provided `/Users/wesley/Downloads/IMG_8981.jpg` as the source. Produce a web image at `apps/web/public/media/yezyy/storefront.jpg` with:

- original aspect ratio preserved for the Visit page;
- sRGB colour profile;
- longest edge at most 2400px;
- JPEG quality between 82 and 88;
- no people added or removed;
- no invented signage.

Record it as `ownership: "yezyy-owned"`, `approvedUse: "identity"`, creator `YezYY owner-provided photo`, source page `owner-provided://IMG_8981.jpg`, and licence `YezYY-owned`.

- [ ] **Step 4: Select and record the three licensed generic images**

Search only source libraries whose official licence explicitly allows commercial website use. Start with:

- Pexels licence: `https://www.pexels.com/license/`
- Unsplash licence: `https://unsplash.com/license`

For each of painted plaster, bracelet beading, and cream piping:

1. Open the individual image page, not a search thumbnail.
2. Reject images copied from a studio website, containing another studio logo, showing identifiable children, or implying a branded character licence YezYY does not hold.
3. Confirm the individual image is covered by the library's commercial-use licence.
4. Download the original, optimize it to a maximum 2400px long edge, and store it under `public/media/licensed`.
5. Record the individual page URL, photographer, official licence URL, current Melbourne download date, and `approvedUse: "category-inspiration"`.
6. Set both disclosures to `Inspiration image` and `灵感示意图`.

If no suitable licensed image passes all six checks for a category, omit that record and use the storefront or text-first fallback. The page must still render without a broken image.

- [ ] **Step 5: Implement manifest validation and safe local media mapping**

`public-media.ts` must reject a generic record when:

- the source or licence URL is not HTTPS;
- creator, licence, or approved use is empty;
- disclosure is missing;
- approved use is `identity`;
- width or height is not a positive integer;
- `localPath` contains `..` or does not begin `/media/`.

The source manifest is server-imported; public components receive only presentation fields and never expose local source-machine paths.

- [ ] **Step 6: Implement the accessible carousel**

Use a stable index, `setInterval(..., 7000)`, `matchMedia("(prefers-reduced-motion: reduce)")`, and cleanup on unmount. Include:

- previous, next, pause/resume controls when `slides.length > 1`;
- `aria-live="polite"` for `Slide n of m`, not for entire hero copy;
- fixed bilingual copy and capability-safe links;
- `Image` with `priority` only for the first slide;
- `objectPosition: slide.focalPoint`;
- image disclosure only for `licensed-generic`;
- no automatic movement under reduced motion.

- [ ] **Step 7: Make homepage data optional by section**

Refactor `loadHomePageData` so settings remain fail-closed while projects,
parties, and gallery load independently. Preserve the complete mapped category
object instead of replacing it with a translated name:

```ts
export type HomePageProjectView = ProjectListItemView;

export type HomePageData = {
  projects: HomePageProjectView[];
  parties: ReturnType<typeof mapPartyFromApi>[];
  galleryImages: ReturnType<typeof mapGalleryImageFromApi>[];
  storeImage: ReturnType<typeof mapGalleryImageFromApi> | null;
  siteSettings: SiteSettingsView;
  media: {
    heroSlides: HeroSlide[];
    storefront: PublicMediaRecord;
  };
};
```

If an optional API call fails, use an empty array and preserve safe
settings/capabilities. If the API is disabled or settings fail, return a usable
static homepage with the licensed media, empty catalogue arrays, and the
existing `minimalSiteSettings` whose capabilities are all false.

- [ ] **Step 8: Run focused and regression tests**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run lib/site/public-media.test.ts lib/site/data.type-test.ts components/sections/HeroCarousel.test.tsx components/sections/BrandFallbacks.test.tsx
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint content lib/site/public-media.ts lib/site/data.ts components/sections/HeroCarousel.tsx
```

Remove the unused `picsum.photos` remote pattern. Expected: all tests PASS; no
remote competitor host is added to `next.config.ts`; all committed generic
assets have a complete manifest record; local images do not depend on a
third-party hotlink remaining available.

- [ ] **Step 9: Commit**

```bash
git add apps/web/content/public-media.json apps/web/lib/site/public-media.ts apps/web/lib/site/public-media.test.ts apps/web/lib/site/data.ts apps/web/components/sections/HeroCarousel.tsx apps/web/components/sections/HeroCarousel.test.tsx apps/web/components/sections/BrandFallbacks.test.tsx apps/web/public/media apps/web/next.config.ts
git commit -m "feat: add licensed public media system"
```

---

### Task 3: Rebuild the Homepage as a Mature DIY Studio Story

**Files:**
- Create: `apps/web/components/sections/ConfidenceStrip.tsx`
- Create: `apps/web/components/sections/FeaturedActivityGrid.tsx`
- Create: `apps/web/components/sections/FeaturedActivityGrid.test.tsx`
- Create: `apps/web/components/sections/HowItWorks.tsx`
- Create: `apps/web/components/sections/StudioStory.tsx`
- Create: `apps/web/components/sections/PartyStory.tsx`
- Create: `apps/web/components/sections/InStoreDiscovery.tsx`
- Create: `apps/web/components/sections/VisitPanel.tsx`
- Create: `apps/web/app/[locale]/page.test.tsx`
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`
- Delete after replacements pass: `apps/web/components/sections/SceneEntry.tsx`
- Delete after replacements pass: `apps/web/components/sections/FeaturedProjects.tsx`
- Delete after replacements pass: `apps/web/components/sections/WhyDIY.tsx`
- Delete after replacements pass: `apps/web/components/sections/PartyPackagesPreview.tsx`
- Delete after replacements pass: `apps/web/components/sections/GalleryHighlight.tsx`
- Delete after replacements pass: `apps/web/components/sections/StoreVibes.tsx`
- Delete after replacements pass: `apps/web/components/sections/WeChatCTA.tsx`

**Interfaces:**
- Consumes: `HomePageData`, `HeroSlide[]`, mapped project/party/gallery views, and `SiteSettingsView["requestCapabilities"]`.
- Produces:

```ts
export const SIGNATURE_CATEGORY_SLUGS = [
  "air-dry-cream-piping",
  "paint-clay",
  "melty-beads",
] as const;

export type SignatureActivityView = {
  categorySlug: (typeof SIGNATURE_CATEGORY_SLUGS)[number];
  name: { en: string; zh: string };
  href: `/projects#${string}`;
  priceDisplay: string;
  durationDisplay: { en: string; zh: string };
  image: PublicMediaRecord | null;
};

export function buildSignatureActivities(
  projects: HomePageProjectView[],
): SignatureActivityView[];
```

The three homepage features are category-level editorial activities, not
invented project records. Group by the existing category slugs above. Derive
the starting price from the minimum `priceMin` in each category and the
duration from its real 30/60-minute values. Link to the category anchor on the
catalogue. Missing categories reduce the grid honestly; no arbitrary fourth
category fills the gap.

- [ ] **Step 1: Write failing selection and homepage composition tests**

```ts
it("builds only the three canonical activity categories in editorial order", () => {
  expect(buildSignatureActivities(shuffledProjects).map((item) => item.categorySlug)).toEqual([
    "air-dry-cream-piping",
    "paint-clay",
    "melty-beads",
  ]);
});

it("derives category facts from real projects instead of inventing a category project", () => {
  const cream = buildSignatureActivities(projects).find(
    (item) => item.categorySlug === "air-dry-cream-piping",
  );
  expect(cream).toMatchObject({
    href: "/projects#air-dry-cream-piping",
    priceDisplay: "From A$18",
    durationDisplay: { en: "30–60 minutes", zh: "30–60 分钟" },
  });
});
```

```tsx
it("orders the homepage as hero, confidence, activities, process, studio, party, store, visit", async () => {
  const html = renderToStaticMarkup(await HomePage({ params: Promise.resolve({ locale: "en" }) }));
  const ids = [
    "home-hero",
    "home-confidence",
    "home-activities",
    "home-process",
    "home-studio",
    "home-party",
    "home-store",
    "home-visit",
  ];
  const positions = ids.map((id) => html.indexOf(`id="${id}"`));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});
```

- [ ] **Step 2: Run tests and verify missing sections fail**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/sections/FeaturedActivityGrid.test.tsx 'app/[locale]/page.test.tsx'
```

Expected: FAIL because the selector and redesigned sections do not exist.

- [ ] **Step 3: Implement the approved homepage sequence**

Render these sections exactly once and in this order:

1. `HeroCarousel`
2. `ConfidenceStrip`
3. `FeaturedActivityGrid`
4. `HowItWorks`
5. `StudioStory`
6. `PartyStory`
7. `InStoreDiscovery`
8. `VisitPanel`

Use the approved layout rhythm:

- warm canvas and white paper alternate with shallow rose-paper sections;
- one strong heading and one primary action per section;
- no repeated equal-weight marketing-card grid;
- real storefront/interior photos receive the largest visual area;
- maximum text width `65ch`;
- mobile horizontal padding at least `16px`;
- desktop section spacing between `80px` and `120px`.

- [ ] **Step 4: Add the exact operational homepage facts**

English:

- `Beginner friendly`
- `Materials included where specified`
- `Manually confirmed`
- `Pay in store`
- process: `Choose a project and preferred time`, `Wait for YezYY to confirm`, `Create and pay in store`

Chinese:

- `新手友好`
- `按项目说明包含材料`
- `人工确认预约`
- `到店付款`
- process: `选择项目和意向时间`, `等待 YezYY 人工确认`, `到店创作并付款`

Do not add reviews, savings claims, instant-confirmation language, or unsupported accessibility claims.

- [ ] **Step 5: Make every homepage action capability-safe**

- Experience enabled: hero and activity actions may link `/book`.
- Experience disabled: hero action links `/projects`; activity cards link the
  matching real category anchor.
- Party enabled: party action links `/parties#party-request`.
- Party disabled: party action links `/contact`.
- Product disabled: `InStoreDiscovery` links `/contact` and contains no price, cart, checkout, or inventory promise.

- [ ] **Step 6: Run tests and visual checks**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/sections 'app/[locale]/page.test.tsx'
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint 'app/[locale]/page.tsx' components/sections
```

Then inspect `/en` and `/zh` at 390×844, 768×1024, and 1440×1000. Expected:

- no horizontal scroll;
- no clipped hero controls;
- no large dark surface;
- no English copy in Chinese structural labels;
- disabled gates show browse/contact actions, not request submission.

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/app/[locale]/page.tsx' 'apps/web/app/[locale]/page.test.tsx' apps/web/components/sections apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: rebuild YezYY public homepage"
```

---

### Task 4: Editorial Project Catalogue and Factual Project Detail

**Files:**
- Create: `apps/web/components/public/ProjectFacts.tsx`
- Create: `apps/web/components/public/ProjectFacts.test.tsx`
- Create: `apps/web/components/projects/ProjectRequestAction.tsx`
- Create: `apps/web/components/projects/ProjectRequestAction.test.tsx`
- Modify: `apps/web/app/[locale]/projects/page.tsx`
- Modify: `apps/web/app/[locale]/projects/[slug]/page.tsx`
- Modify: `apps/web/components/projects/CategoryNav.tsx`
- Modify: `apps/web/components/projects/CategorySection.tsx`
- Modify: `apps/web/components/projects/ProjectCard.tsx`
- Modify: `apps/web/components/projects/ProjectDetail.tsx`
- Modify: `apps/web/components/projects/ProjectDetail.test.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Produces:

```ts
export type ProjectFact = {
  label: string;
  value: string;
};

export type ProjectRequestActionProps = {
  projectId: string;
  projectSlug: string;
  projectType: "experience" | "product";
  requestEnabled: boolean;
  bookable: boolean;
};
```

- `ProjectRequestAction` behavior:
  - disabled experience → `/contact` or `/projects` informational link;
  - enabled experience → `/book?project=<encoded slug>`;
  - disabled product → no cart control, contact fallback only;
  - enabled product → existing style/cart flow may render, but this plan keeps the production product gate false.

- [ ] **Step 1: Write failing factual-display and gate tests**

```tsx
it("renders price, duration, and in-store variant facts without badges", () => {
  render(
    <ProjectFacts
      facts={[
        { label: "From", value: "A$43" },
        { label: "Duration", value: "30 minutes" },
        { label: "Choose in store", value: "Yes" },
      ]}
    />,
  );
  expect(screen.getByText("A$43")).toBeInTheDocument();
  expect(screen.getByText("30 minutes")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
});

it("does not render cart or embedded legacy booking when the request is disabled", () => {
  const html = renderProjectDetail({ requestEnabled: false, projectType: "experience" });
  expect(html).not.toContain("BookingCalendar");
  expect(html).not.toContain("/cart");
  expect(html).toContain("/contact");
});
```

- [ ] **Step 2: Run focused tests and verify the new contract fails**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/public/ProjectFacts.test.tsx components/projects/ProjectRequestAction.test.tsx components/projects/ProjectDetail.test.tsx
```

Expected: FAIL because `ProjectFacts` and `ProjectRequestAction` do not exist.

- [ ] **Step 3: Rebuild catalogue presentation without changing grouping data**

Keep `loadProjectsPageData` and `groupProjectsByCategory` as the data boundary. Restyle:

- one editorial intro;
- sticky, horizontally scrollable category navigation with visible focus;
- image-led grid with consistent aspect ratio;
- localized name, starting price, duration, and a single detail link;
- honest empty sections removed by existing grouping;
- licensed generic image disclosure when a category record uses manifest media.

Do not display product projects as purchasable when the product gate is false.

- [ ] **Step 4: Split ProjectDetail presentation from action behavior**

Remove direct `BookingCalendar` and `BookingForm` composition from `ProjectDetail`. The canonical ordinary flow is `/book`; deep-link it with the project slug when enabled. Retain:

- responsive image gallery;
- localized description and tags;
- current AUD price;
- `durationMinutes`/localized duration;
- age guidance only when present in API tags or confirmed copy;
- variant-selected-in-store fact;
- extra-time facts only from mapped API values.

Use text alternatives for missing images. Do not substitute a different project's image.

- [ ] **Step 5: Run focused tests, typecheck, and lint**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/public/ProjectFacts.test.tsx components/projects
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint 'app/[locale]/projects' components/projects components/public/ProjectFacts.tsx
```

Expected: PASS and no direct `BookingCalendar`, `BookingForm`, `CartIcon`, or `/cart` reference remains in the disabled project-detail render path.

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/[locale]/projects' apps/web/components/projects apps/web/components/public/ProjectFacts.tsx apps/web/components/public/ProjectFacts.test.tsx apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: redesign public DIY catalogue"
```

---

### Task 5: Editorial Parties Page With Preserved Request Workflow

**Files:**
- Create: `apps/web/components/parties/PartyPackageComparison.tsx`
- Create: `apps/web/components/parties/PartyPackageComparison.test.tsx`
- Modify: `apps/web/app/[locale]/parties/page.tsx`
- Modify: `apps/web/app/[locale]/parties/page.test.tsx`
- Modify: `apps/web/components/parties/PartyInquiryCTA.tsx`
- Modify: `apps/web/components/parties/PartyBookingForm.tsx`
- Modify: `apps/web/components/parties/PartyInquiryCTA.test.tsx`
- Modify: `apps/web/components/parties/PartyBookingForm.test.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Keep the existing verified `PartyCard` facts: 90/A$95 and 150/A$145, setup 30, cleanup 30, minimum 4, maximum 8, A$45 minimum spend per person, and 1–2 supervising parents.
- Produces:

```ts
type PartyPackageComparisonProps = {
  locale: "en" | "zh";
  packages: PartyCard[];
};
```

Extend the page-local verified view with the mapped package slug:

```ts
type PartyCard = {
  id?: string;
  slug: string;
  // existing verified package fact fields remain unchanged
};
```

Live packages use `party.slug.current`. Safe fallback packages use
`standard-party-90` and `extended-party-150`; only a live package can render
the request form.

- The request form is rendered only when `settings.requestCapabilities.party && hasCompleteLiveCatalogue`.
- Each package article keeps `id={party.slug}` so public closure tests can
  locate the exact live fixture slug.

- [ ] **Step 1: Write failing editorial and gating tests**

```tsx
it("shows both verified venue fees and calls them in-store deposits", async () => {
  const html = await renderParties({ locale: "en", requestEnabled: false });
  expect(html).toContain("A$95");
  expect(html).toContain("A$145");
  expect(html).toContain("venue fee and deposit");
  expect(html).toContain("paid in store");
});

it("shows contact planning instead of a request form while the party gate is false", async () => {
  const html = await renderParties({ locale: "en", requestEnabled: false });
  expect(html).not.toContain('id="party-request-form"');
  expect(html).toContain('href="/contact"');
});
```

- [ ] **Step 2: Run tests and verify current visual/wording expectations fail**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run 'app/[locale]/parties/page.test.tsx' components/parties
```

Expected: FAIL on the new editorial structure and contact fallback assertions.

- [ ] **Step 3: Replace SaaS-style package cards with an editorial page**

Build:

- one wide photographic introduction;
- concise party invitation and a factual two-column comparison;
- included setup, birthday gift, voucher exclusions, BYO food/cake/drink rules;
- cake cutting, cleaning, overtime, minimum spend, supervision, age 5+, and 48-hour refund wording;
- a clear explanation that date/time submission is a request;
- one request section or contact fallback.

Use rose-paper and white surfaces. Remove the dark price block, radial gradient, pill clusters, and repeated rounded cards.
Preserve the stable package `id` used by
`apps/web/e2e/party-closure.spec.ts`.

- [ ] **Step 4: Preserve the existing form and API workflow**

Do not change request payload names or API validation. Only align:

- field spacing and headings;
- inline error summary visibility;
- policy consent link;
- request/manual-confirmation/pay-in-store explanation;
- success confirmation language.

The server remains authoritative for 4–8 attendance, 2-hour minimum lead time, one-week horizon, capacity, and party duration.

- [ ] **Step 5: Run tests and verify bilingual responsive output**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run 'app/[locale]/parties/page.test.tsx' components/parties
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint 'app/[locale]/parties/page.tsx' components/parties
```

Inspect `/en/parties` and `/zh/parties` at 390px and 1440px. Expected: package facts remain comparable, no false confirmation language appears, and disabled request state has no form submission control.

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/[locale]/parties/page.tsx' 'apps/web/app/[locale]/parties/page.test.tsx' apps/web/components/parties apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: redesign YezYY party planning page"
```

---

### Task 6: Honest Gallery and Visit YezYY Page

**Files:**
- Create: `apps/web/components/gallery/GalleryGrid.tsx`
- Create: `apps/web/components/gallery/GalleryGrid.test.tsx`
- Create: `apps/web/components/visit/BusinessHoursList.tsx`
- Create: `apps/web/components/visit/BusinessHoursList.test.tsx`
- Modify: `apps/web/app/[locale]/gallery/page.tsx`
- Modify: `apps/web/app/[locale]/contact/page.tsx`
- Modify: `apps/web/lib/site/business.ts`
- Modify: `apps/web/lib/site/business.test.ts`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Produces:

```ts
export type BusinessHourRow = {
  day: string;
  hours: string;
};

export function getBusinessHourRows(locale: "en" | "zh"): BusinessHourRow[];
```

- `GalleryGrid` consumes only mapped API gallery images. It never imports licensed generic media.

- [ ] **Step 1: Write failing gallery-integrity and hours tests**

```ts
it("returns seven localized business-hour rows in Monday-first order", () => {
  const rows = getBusinessHourRows("en");
  expect(rows).toHaveLength(7);
  expect(rows[0]).toEqual({ day: "Monday", hours: "9:30 am–5:00 pm" });
  expect(rows[6]).toEqual({ day: "Sunday", hours: "10:00 am–5:00 pm" });
});
```

```tsx
it("renders only API-approved YezYY gallery entries", () => {
  render(<GalleryGrid locale="en" images={approvedImages} />);
  expect(screen.getAllByRole("img")).toHaveLength(approvedImages.length);
  expect(screen.queryByText("Inspiration image")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and verify the new contracts fail**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/gallery/GalleryGrid.test.tsx components/visit/BusinessHoursList.test.tsx lib/site/business.test.ts
```

Expected: FAIL because the gallery and structured hours exports do not exist.

- [ ] **Step 3: Build the honest gallery**

Use only `loadGalleryPageData()` results filtered by a non-empty `imageUrl`. Render:

- natural aspect-ratio masonry-like CSS grid without JavaScript layout;
- localized captions;
- category-aware text such as store space, project example, or customer work;
- meaningful alternative text;
- smaller honest collection when few images exist;
- existing empty-catalogue contact fallback when no publishable image exists.

Do not import `public-media.json` into the gallery.

- [ ] **Step 4: Rebuild `/contact` as `Visit YezYY`**

Use the YezYY storefront image and render:

- address;
- structured seven-row opening hours;
- telephone and email tap targets;
- Xiaohongshu ID and verified Instagram when later supplied;
- external Google Maps directions link;
- embedded map after primary visit facts, with descriptive title and lazy loading;
- an empty accessibility-notes area omitted entirely until the owner confirms facts.

On mobile, keep the map after the contact information so it cannot block the primary visit actions.

- [ ] **Step 5: Run tests, typecheck, lint, and mobile QA**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/gallery components/visit lib/site/business.test.ts
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint 'app/[locale]/gallery/page.tsx' 'app/[locale]/contact/page.tsx' components/gallery components/visit lib/site/business.ts
```

Inspect `/en/gallery`, `/zh/gallery`, `/en/contact`, and `/zh/contact` at 390px. Expected: no licensed generic category image appears in Gallery; Visit contains the correct address, phone, hours, and no unsupported accessibility promise.

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/[locale]/gallery/page.tsx' 'apps/web/app/[locale]/contact/page.tsx' apps/web/components/gallery apps/web/components/visit apps/web/lib/site/business.ts apps/web/lib/site/business.test.ts apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: redesign YezYY gallery and visit pages"
```

---

### Task 7: Align Booking, Waitlist, and Secure Management With the Public System

**Files:**
- Create: `apps/web/components/book/BookingPolicySummary.tsx`
- Create: `apps/web/components/book/BookingPolicySummary.test.tsx`
- Modify: `apps/web/app/[locale]/book/page.tsx`
- Modify: `apps/web/app/[locale]/manage-booking/[token]/page.tsx`
- Modify: `apps/web/app/[locale]/manage-booking/[token]/page.test.tsx`
- Modify: `apps/web/components/book/OrdinaryBookingForm.tsx`
- Modify: `apps/web/components/book/OrdinaryBookingForm.test.tsx`
- Modify: `apps/web/components/book/CustomerBookingActions.tsx`
- Modify: `apps/web/components/book/CustomerBookingActions.test.tsx`
- Modify: `apps/web/components/book/PolicyConsent.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Preserve every existing booking and customer-action function signature.
- `BookingPolicySummary` accepts:

```ts
type BookingPolicySummaryProps = {
  locale: "en" | "zh";
  kind: "experience" | "party";
};
```

Extend `OrdinaryBookingFormProps` with:

```ts
initialProjectSlug?: string;
```

`BookPage` reads `searchParams: Promise<{ project?: string }>` and passes only a
slug that exactly matches one of the loaded, bookable experience projects.
Unknown, product, or unbookable slugs are ignored.

- It displays confirmed facts only and links `/booking-policy`.

- [ ] **Step 1: Write failing presentation-safety tests**

```tsx
it("keeps request-disabled booking as a contact-safe state", () => {
  render(<OrdinaryBookingForm locale="en" projects={projects} requestEnabled={false} />);
  expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  expect(screen.getByText(/manually confirm/i)).toBeInTheDocument();
});

it("keeps secure management noindex and exposes no internal booking id", async () => {
  const html = renderToStaticMarkup(await ManageBookingPage({ params }));
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(html).not.toContain(booking.internalId);
});
```

- [ ] **Step 2: Run focused tests and verify new policy presentation fails**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/book/BookingPolicySummary.test.tsx components/book/OrdinaryBookingForm.test.tsx components/book/CustomerBookingActions.test.tsx 'app/[locale]/manage-booking/[token]/page.test.tsx'
```

Expected: FAIL because `BookingPolicySummary` does not exist and the approved public presentation is absent.

- [ ] **Step 3: Align the ordinary booking page without duplicating backend rules**

Preserve `OrdinaryBookingForm` state, payloads, availability refresh, idempotency, and stale-slot behavior. Restyle:

- editorial intro;
- a four-step progress list;
- readable participant/project/schedule/contact sections;
- top-level error summary linked to invalid fields;
- policy facts near consent;
- success state that says request received, manual confirmation pending, and pay in store.
- optional project preselection from the validated `initialProjectSlug`,
  without changing quantity or submitting automatically.

Do not hard-code capacity, lead time, or horizon in component validation. Display those facts from existing confirmed messages; the API remains decisive.

- [ ] **Step 4: Align secure management pages**

Preserve:

- `robots: { index: false, follow: false }`;
- `referrer: "no-referrer"`;
- generic invalid-token response;
- token-only API access;
- server-provided allowed actions;
- proposed-time acceptance;
- cancellation/reschedule request semantics.

Apply the public rose-paper visual system and improve field/error spacing. Do not show internal IDs, admin notes, tokens, or operational event history.

- [ ] **Step 5: Run focused booking tests and closure E2E**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run components/book 'app/[locale]/manage-booking/[token]/page.test.tsx' lib/actions/booking.test.ts lib/api/customer-booking.test.ts
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint 'app/[locale]/book/page.tsx' 'app/[locale]/manage-booking/[token]/page.tsx' components/book
```

When the backend Task 12 environment is ready, run:

```bash
cd apps/web
./node_modules/.bin/playwright test e2e/experience-closure.spec.ts e2e/party-closure.spec.ts
```

These two closure specs run in the dedicated test environment with the
experience and party gates enabled and prove that presentation changes did not
break their complete workflows. Separate false-gate UI tests prove production
entry points remain closed. Product closure is excluded because product
requests remain intentionally disabled.

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/[locale]/book/page.tsx' 'apps/web/app/[locale]/manage-booking/[token]/page.tsx' 'apps/web/app/[locale]/manage-booking/[token]/page.test.tsx' apps/web/components/book apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json
git commit -m "feat: align booking flows with public design"
```

---

### Task 8: Bilingual Policies, Metadata, Full Regression, and Gated Production Readiness

**Files:**
- Create: `apps/web/app/[locale]/privacy/page.tsx`
- Create: `apps/web/app/[locale]/terms/page.tsx`
- Create: `apps/web/app/[locale]/booking-policy/page.tsx`
- Create: `apps/web/app/[locale]/policies.test.tsx`
- Create: `apps/web/e2e/public-redesign.spec.ts`
- Create: `apps/web/e2e/public-responsive.spec.ts`
- Modify: `apps/web/i18n/routing.ts`
- Modify: `apps/web/app/[locale]/layout.tsx`
- Modify: `apps/web/components/public/PublicFooter.tsx`
- Modify: `apps/web/components/public/PublicFooter.test.tsx`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/app/robots.ts`
- Modify: `apps/web/lib/site/metadata.ts`
- Modify: `apps/web/lib/site/metadata.test.ts`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`
- Modify: `apps/web/lib/testing/production-checklist.test.ts`

**Interfaces:**
- Policy routes use static, localized operational drafts and `buildPageMetadata`.
- Policy pages are `noindex` and omitted from production footer/navigation
  until the owner supplies the registered business name, approves the wording,
  and `NEXT_PUBLIC_POLICY_NAV_ENABLED=true`.
- Sitemap adds approved policy pages only when the policy navigation gate is
  true. It never adds `/book`, `/cart`, `/manage-booking`, `/admin`, or API
  routes while the corresponding launch gate is closed.
- Produces:

```ts
export function isPolicyNavigationEnabled(): boolean;

export function buildPolicyMetadata(
  locale: "en" | "zh",
  policy: "privacy" | "terms" | "booking-policy",
): Metadata;
```

- [ ] **Step 1: Write failing policy, metadata, and route-exposure tests**

```tsx
it.each(["privacy", "terms", "booking-policy"])(
  "renders bilingual %s content without describing it as legal advice",
  async (route) => {
    const en = await renderPolicy(route, "en");
    const zh = await renderPolicy(route, "zh");
    expect(en).toContain("YezYY");
    expect(zh).toContain("YezYY");
    expect(en).toContain("manually confirmed");
    expect(zh).toContain("人工确认");
  },
);
```

```ts
it("does not advertise closed mutation routes in the sitemap", async () => {
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  expect(urls.some((url) => url.endsWith("/book"))).toBe(false);
  expect(urls.some((url) => url.endsWith("/cart"))).toBe(false);
  expect(urls.some((url) => url.includes("/manage-booking/"))).toBe(false);
});

it("keeps unapproved policy drafts out of navigation and search", async () => {
  process.env.NEXT_PUBLIC_POLICY_NAV_ENABLED = "false";
  const entries = await sitemap();
  expect(entries.some((entry) => entry.url.endsWith("/privacy"))).toBe(false);
  expect(buildPolicyMetadata("en", "privacy").robots).toEqual({
    index: false,
    follow: false,
  });
});
```

- [ ] **Step 2: Run tests and verify missing policy routes fail**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run 'app/[locale]/policies.test.tsx' lib/site/metadata.test.ts lib/testing/production-checklist.test.ts
```

Expected: FAIL because the three policy pages and route assertions do not exist.

- [ ] **Step 3: Add plain-language bilingual policy drafts**

Cover these confirmed operational facts:

- contact data is used to process and manage requests;
- requests require manual confirmation;
- payment is in store;
- secure management links must not be shared;
- ordinary DIY cancellation and rescheduling are requests pending manual handling;
- party refund requires at least 48 hours' notice;
- party venue fees/deposits are paid in store;
- late arrival may require rearrangement;
- children must be at least five for parties and require 1–2 supervising parents;
- contact channels and Melbourne business address.

State that the pages are YezYY operational information, not external legal advice. Do not invent an ABN, registered entity, data-retention period, refund right, or governing-law clause.

Add `/privacy`, `/terms`, and `/booking-policy` to
`apps/web/i18n/routing.ts` for both locales. Add footer links only when the
policy navigation gate is true.

- [ ] **Step 4: Update metadata, sitemap, and robots safely**

Add locale alternates and canonical URLs through `buildPageMetadata`. Use YezYY storefront Open Graph imagery only. Keep:

- `/admin` and `/api/` disallowed;
- secure manage pages `noindex`;
- book/cart excluded from sitemap while closed;
- projects, parties, gallery, contact, and approved policy pages discoverable.

- [ ] **Step 5: Add public cross-route Playwright coverage**

`public-redesign.spec.ts` must assert:

- exact brand `YezYY`;
- nav routes and locale switch;
- no cart/product entry under false gates;
- hero disabled action goes to projects;
- party disabled action goes to Visit;
- no fake review block;
- footer contact facts.

`public-responsive.spec.ts` must check 320×800, 390×844, 768×1024, and 1440×1000 for:

- `document.documentElement.scrollWidth === document.documentElement.clientWidth`;
- visible menu controls;
- visible focus on keyboard navigation;
- hero controls within viewport;
- no large element using `#2D2D2F`, `#3D3D3D`, or near-black as a full-width section background.

- [ ] **Step 6: Run the complete verification matrix**

Run:

```bash
cd apps/web
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/next build
./node_modules/.bin/playwright test e2e/public-redesign.spec.ts e2e/public-responsive.spec.ts
```

Then run the stable repository-level experience and party closure validation
from the worktree root:

```bash
node apps/web/e2e/run-closure.mjs -- e2e/experience-closure.spec.ts e2e/party-closure.spec.ts
```

Expected:

- unit tests PASS;
- typecheck, lint, and build exit 0;
- public Playwright tests PASS at all four viewports;
- false-gate tests prove experience, party, and product public mutations remain
  unavailable in the production configuration;
- dedicated closure tests prove experience and party workflows still complete
  when enabled in the isolated test environment;
- `public-media.json` contains no missing licence field or competitor URL;
- admin booking and schedule pages remain visually and functionally intact.

- [ ] **Step 7: Perform final production-gate inspection**

Verify the deployment environment still contains:

```text
REQUEST_FLOW_EXPERIENCE_ENABLED=false
REQUEST_FLOW_PARTY_ENABLED=false
REQUEST_FLOW_PRODUCT_ENABLED=false
```

Verify the database settings response returns all three public capabilities as false. Do not enable them in this task. Deploy only after the backend production-readiness plan has completed its final gated checks.

- [ ] **Step 8: Commit**

```bash
git add 'apps/web/app/[locale]/privacy' 'apps/web/app/[locale]/terms' 'apps/web/app/[locale]/booking-policy' 'apps/web/app/[locale]/policies.test.tsx' apps/web/app/sitemap.ts apps/web/app/robots.ts apps/web/lib/site/metadata.ts apps/web/lib/site/metadata.test.ts apps/web/lib/i18n/messages/en.json apps/web/lib/i18n/messages/zh.json apps/web/lib/testing/production-checklist.test.ts apps/web/e2e/public-redesign.spec.ts apps/web/e2e/public-responsive.spec.ts
git commit -m "feat: complete gated public site redesign"
```

---

## Execution Order and Parallel Boundary

Public redesign work executes in a new isolated worktree and branch. It does not share uncommitted files with the backend Owner bootstrap and production-readiness branch.

Within the public plan:

1. Task 1 must complete first because all later routes consume the public shell and action contract.
2. Task 2 follows Task 1 because homepage and project pages consume the media contract.
3. Tasks 3, 4, 5, and 6 may be implemented and reviewed independently after Tasks 1–2, but only one implementation agent may edit the public worktree at a time unless separate task worktrees are created and merged deliberately.
4. Task 7 begins only after the backend booking/customer APIs used by the current production plan are stable.
5. Task 8 runs last and is the only task allowed to claim production readiness.

The preselected execution mode is **Subagent-Driven**: dispatch a fresh implementer per task, run an independent review after every task, resolve Important findings, and keep the production request gates false.
