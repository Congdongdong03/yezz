# YezYY Public Project Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual, curated public DIY catalogue while preserving the existing operational project records and keeping all public request gates closed.

**Architecture:** Keep `diy_projects` as the source of truth for booking duration, capacity, and price. Add `catalogue_entries` and `catalogue_entry_projects` as a separate presentation layer that groups one or more operational projects into a public story, controls publication, and records truthful image provenance. Add dedicated public and Chinese-admin catalogue APIs, then migrate the public homepage, projects page, and project detail page to the catalogue API.

**Tech Stack:** PostgreSQL, Drizzle ORM, Fastify, Next.js App Router, TypeScript, next-intl, Vitest, Playwright

## Global Constraints

- Currency is AUD and payment happens in store.
- Public `experience`, `party`, and `product` request capabilities remain `false`.
- `bookable` must never be reused as a public publication flag.
- Existing operational project IDs remain stable.
- Generic licensed images are labelled `DIY inspiration / DIY 灵感图`.
- Generic images are never described as YezYY customers, staff, or completed YezYY work.
- Ordinary DIY receives no new minimum-age rule.
- Public category order is Deco Cream DIY, Plaster Painting, Beading, Melty Beads.
- Customer-facing Deco Cream times are 15–30 minutes for small projects and 30–45 minutes for medium/large projects.
- Plaster Painting remains approximately one hour.
- The public launch set is six Deco Cream entries, one grouped Plaster Painting entry, one Beading entry, and one Melty Beads entry.
- Existing unrelated `.superpowers/brainstorm/` and `.vercel/` paths must not be staged or modified.

---

## File Structure

### Database presentation boundary

- Create `packages/db/src/catalogue-data.ts`: approved bilingual launch catalogue records.
- Modify `packages/db/src/schema/index.ts`: catalogue entry and entry-to-project tables.
- Create `packages/db/migrations/0007_yezyy_public_catalogue.sql`: additive catalogue schema.
- Create `packages/db/src/seed-public-catalogue.ts`: idempotent public-catalogue seed.
- Create `packages/db/src/catalogue-data.test.ts`: exact approved data assertions.
- Create `packages/db/src/seed-public-catalogue.integration.test.ts`: isolated PostgreSQL seed verification.

### API boundary

- Create `apps/api/src/repositories/catalogue.repository.ts`: public/admin catalogue persistence.
- Create `apps/api/src/services/catalogue.service.ts`: published public DTOs.
- Create `apps/api/src/services/admin/catalogue.admin.service.ts`: admin CRUD and validation.
- Create `apps/api/src/routes/v1/catalogue.routes.ts`: read-only public catalogue endpoints.
- Create `apps/api/src/routes/v1/admin/catalogue.routes.ts`: Chinese-admin catalogue endpoints.
- Modify `apps/api/src/routes/v1/index.ts`, `apps/api/src/routes/v1/admin/index.ts`, and `apps/api/src/plugins/services.ts`: service/route registration.
- Add focused repository, service, and route tests beside each new module.

### Public web

- Modify `apps/web/lib/api/types.ts`, `client.ts`, and `mappers.ts`: catalogue API types and mapping.
- Create `apps/web/lib/catalogue/data.ts`: resilient page loaders.
- Create `apps/web/lib/catalogue/data.test.ts`: grouping, publication, and failure tests.
- Create `apps/web/components/catalogue/CatalogueCategoryGrid.tsx`: four homepage category entrances.
- Create `apps/web/components/catalogue/CatalogueSection.tsx`: curated category section.
- Create `apps/web/components/catalogue/CatalogueCard.tsx`: representative project card.
- Create `apps/web/components/catalogue/CatalogueDetail.tsx`: detail, variants, facts, disclosure, and closed fallback.
- Modify `apps/web/app/[locale]/page.tsx`, `projects/page.tsx`, and `projects/[slug]/page.tsx`.
- Modify `apps/web/lib/i18n/messages/en.json` and `zh.json`.

### Chinese admin

- Create `apps/web/app/admin/catalogue/page.tsx`: catalogue list and publication state.
- Create `apps/web/app/admin/catalogue/new/page.tsx`.
- Create `apps/web/app/admin/catalogue/[id]/edit/page.tsx`.
- Create `apps/web/components/admin/CatalogueForm.tsx`.
- Modify `apps/web/lib/admin/types.ts`, `api.ts`, and the admin navigation.
- Add component tests for list, form, validation, and publication controls.

---

### Task 1: Add the catalogue presentation schema

**Files:**
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/migrations/0007_yezyy_public_catalogue.sql`
- Modify: `packages/db/migrations/meta/_journal.json`
- Generate: `packages/db/migrations/meta/0007_snapshot.json`
- Test: `packages/db/src/migrations/public-catalogue.migration.test.ts`

**Interfaces:**
- Produces: `catalogueEntries`, `catalogueEntryProjects`, `CatalogueImageKind`
- Consumes: existing `projectCategories`, `diyProjects`, and `LocalizedString`

- [ ] **Step 1: Write the failing migration test**

```ts
it("adds catalogue publication and project grouping without changing bookable", async () => {
  const columns = await sql<{
    published: boolean;
    featured: boolean;
    imageKind: string;
  }[]>`
    select published, featured, image_kind as "imageKind"
    from catalogue_entries
    where false
  `;
  expect(columns).toEqual([]);

  const links = await sql<{ total: number }[]>`
    select count(*)::int as total from catalogue_entry_projects
  `;
  expect(links[0]?.total).toBe(0);
});
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run:

```bash
corepack pnpm --filter @yezz/db test -- src/migrations/public-catalogue.migration.test.ts
```

Expected: FAIL because `catalogue_entries` does not exist.

- [ ] **Step 3: Add the schema**

Add:

```ts
export type CatalogueImageKind = "yezyy" | "inspiration" | "placeholder";

export const catalogueEntries = pgTable("catalogue_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => projectCategories.id, { onDelete: "restrict" }),
  name: jsonb("name").$type<LocalizedString>().notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: jsonb("description").$type<LocalizedString>().notNull(),
  durationDisplay: jsonb("duration_display").$type<LocalizedString>().notNull(),
  occasionTags: jsonb("occasion_tags").$type<LocalizedString[]>().notNull().default([]),
  availabilityNote: jsonb("availability_note").$type<LocalizedString>().notNull(),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  coverImageUrl: text("cover_image_url"),
  imageKind: varchar("image_kind", { length: 32 })
    .$type<CatalogueImageKind>()
    .notNull()
    .default("placeholder"),
  imageSourceUrl: text("image_source_url"),
  imageLicenseUrl: text("image_license_url"),
  imageAttribution: jsonb("image_attribution").$type<LocalizedString>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const catalogueEntryProjects = pgTable(
  "catalogue_entry_projects",
  {
    catalogueEntryId: uuid("catalogue_entry_id")
      .notNull()
      .references(() => catalogueEntries.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => diyProjects.id, { onDelete: "restrict" }),
    label: jsonb("label").$type<LocalizedString>(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.catalogueEntryId, table.projectId] }),
  ],
);
```

The SQL migration must add the two tables, foreign keys, unique slug, image-kind check, and indexes for `(published, sort_order)` and `(catalogue_entry_id, sort_order)`.

- [ ] **Step 4: Generate migration metadata and rerun the test**

Run:

```bash
corepack pnpm --filter @yezz/db generate
corepack pnpm --filter @yezz/db test -- src/migrations/public-catalogue.migration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/migrations packages/db/src/migrations/public-catalogue.migration.test.ts
git commit -m "feat(db): add public catalogue presentation schema"
```

---

### Task 2: Define and seed the approved launch catalogue

**Files:**
- Create: `packages/db/src/catalogue-data.ts`
- Create: `packages/db/src/catalogue-data.test.ts`
- Create: `packages/db/src/seed-public-catalogue.ts`
- Create: `packages/db/src/seed-public-catalogue.integration.test.ts`
- Modify: `packages/db/package.json`
- Modify: `packages/db/src/bootstrap-production.ts`
- Modify: `packages/db/src/live-booking-catalogue.ts`
- Modify: `packages/db/src/live-booking-catalogue.test.ts`

**Interfaces:**
- Consumes: `catalogueEntries`, `catalogueEntryProjects`, existing live project slugs
- Produces: `PUBLIC_CATALOGUE_ENTRIES`, `seedPublicCatalogue(db)`

- [ ] **Step 1: Write the failing catalogue-data test**

```ts
it("defines the nine approved public catalogue entries", () => {
  expect(PUBLIC_CATALOGUE_ENTRIES.map((entry) => entry.slug)).toEqual([
    "deco-cream-two-hair-clips",
    "deco-cream-mini-drawers",
    "deco-cream-phone-case",
    "deco-cream-lamp",
    "deco-cream-medium-storage",
    "deco-cream-large-storage",
    "plaster-painting",
    "beading",
    "melty-beads",
  ]);
  expect(
    PUBLIC_CATALOGUE_ENTRIES.find((entry) => entry.slug === "plaster-painting")
      ?.projectSlugs,
  ).toEqual([
    "paint-clay-figurine-mini",
    "paint-clay-figurine-small",
    "paint-clay-figurine-medium",
    "paint-clay-figurine-large",
  ]);
});
```

Also assert:

- phone case price source is A$66–A$76;
- lamp price source is A$43–A$98;
- Beading variants are A$43, A$43, A$60.50, A$71.50, and A$93.50;
- Melty Beads is A$49.50/hour with A$16.50/30 minutes extra;
- Deco Cream duration labels match the approved small/medium ranges.

- [ ] **Step 2: Run the unit test to verify it fails**

Run:

```bash
corepack pnpm --filter @yezz/db test -- src/catalogue-data.test.ts
```

Expected: FAIL because `PUBLIC_CATALOGUE_ENTRIES` does not exist.

- [ ] **Step 3: Add exact bilingual catalogue data**

Use:

```ts
export type PublicCatalogueSeed = {
  categorySlug: LiveCategorySlug;
  slug: string;
  name: LocalizedString;
  description: LocalizedString;
  durationDisplay: LocalizedString;
  occasionTags: LocalizedString[];
  projectSlugs: string[];
  published: true;
  featured: boolean;
  sortOrder: number;
  image: {
    coverImageUrl: string;
    imageKind: "inspiration";
    sourceUrl: string;
    licenseUrl: string;
    attribution: string;
  };
};
```

All descriptions must state only confirmed activities. Use controlled occasion tags
from the design spec. Keep the approved licensed media metadata in this database-safe
seed module; do not import the web-only editorial media registry. The seed must write
the image URL, source URL, licence URL, attribution, and `inspiration` disclosure into
the catalogue presentation row.

- [ ] **Step 4: Correct operational variant price ranges and styles**

Update the existing live data without changing project slugs:

```ts
// Lamp
priceMinCents: 4300,
priceMaxCents: 9800,

// Phone case
priceMinCents: 6600,
priceMaxCents: 7600,
```

Seed Beading styles with these exact labels/prices:

```ts
[
  { name: { en: "Bracelet", zh: "手链" }, price: "43.00" },
  { name: { en: "Phone Strap 20cm", zh: "手机链 20cm" }, price: "43.00" },
  { name: { en: "Phone Strap 30cm", zh: "手机链 30cm" }, price: "60.50" },
  { name: { en: "Phone Strap 40cm", zh: "手机链 40cm" }, price: "71.50" },
  { name: { en: "Bag Chain", zh: "包链" }, price: "93.50" },
]
```

- [ ] **Step 5: Write the failing isolated seed integration test**

The test must:

- create the four categories and required operational projects;
- run `seedPublicCatalogue(db)` twice;
- assert nine published entries;
- assert Plaster Painting links to four stable operational IDs;
- assert no `diy_projects.bookable` values changed;
- assert re-running produces no duplicates.

- [ ] **Step 6: Implement the idempotent seed**

`seedPublicCatalogue(db)` must:

1. validate every referenced category and project slug;
2. upsert catalogue entries by slug;
3. replace only that entry's junction rows in one transaction;
4. preserve owner-uploaded `coverImageUrl` when it is already non-null;
5. preserve any admin-set `published=false` after initial creation;
6. never delete operational projects.

- [ ] **Step 7: Run data and integration tests**

Run:

```bash
corepack pnpm --filter @yezz/db test -- src/catalogue-data.test.ts
YEZYY_RUN_DB_CATALOGUE_TESTS=1 corepack pnpm --filter @yezz/db test -- src/seed-public-catalogue.integration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src packages/db/package.json
git commit -m "feat(db): seed curated YezYY catalogue"
```

---

### Task 3: Add the read-only public catalogue API

**Files:**
- Create: `apps/api/src/repositories/catalogue.repository.ts`
- Create: `apps/api/src/repositories/catalogue.repository.test.ts`
- Create: `apps/api/src/services/catalogue.service.ts`
- Create: `apps/api/src/services/catalogue.service.test.ts`
- Create: `apps/api/src/routes/v1/catalogue.routes.ts`
- Create: `apps/api/src/routes/v1/catalogue.routes.test.ts`
- Modify: `apps/api/src/plugins/services.ts`
- Modify: `apps/api/src/routes/v1/index.ts`
- Modify: `apps/api/src/lib/cache.ts`

**Interfaces:**
- Produces:

```ts
type CatalogueVariantDto = {
  projectId: string;
  slug: string;
  name: LocalizedString;
  label: LocalizedString | null;
  priceDisplay: string | null;
  bookable: boolean;
  sortOrder: number;
};

type CatalogueEntryDto = {
  id: string;
  slug: string;
  name: LocalizedString;
  description: LocalizedString;
  durationDisplay: LocalizedString;
  occasionTags: LocalizedString[];
  availabilityNote: LocalizedString;
  featured: boolean;
  sortOrder: number;
  coverImageUrl: string | null;
  image: {
    kind: "yezyy" | "inspiration" | "placeholder";
    sourceUrl: string | null;
    licenseUrl: string | null;
    attribution: LocalizedString | null;
  };
  category: CategorySummaryDto;
  variants: CatalogueVariantDto[];
  priceDisplay: string | null;
};
```

- Endpoints:
  - `GET /api/v1/catalogue`
  - `GET /api/v1/catalogue/:slug`

- [ ] **Step 1: Write failing service tests**

Test that:

- unpublished entries never appear in `list()`;
- entries sort by category order, then catalogue sort order;
- grouped Plaster Painting returns four variants;
- `priceDisplay` is `A$19.80–A$54.00`;
- one-entry price ranges use operational project cents;
- missing slug returns `NOT_FOUND`;
- image provenance is returned intact.

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/catalogue.service.test.ts
```

Expected: FAIL because the catalogue service does not exist.

- [ ] **Step 3: Implement repository and service**

The public repository query must include:

```ts
where(eq(catalogueEntries.published, true))
```

Variant prices must be calculated with the existing `resolveProjectPricing()` helper. Do not parse display strings for operational prices.

- [ ] **Step 4: Add route tests**

Assert:

```ts
expect((await app.inject({ method: "GET", url: "/api/v1/catalogue" })).statusCode)
  .toBe(200);
expect((await app.inject({ method: "GET", url: "/api/v1/catalogue/private" })).statusCode)
  .toBe(404);
```

- [ ] **Step 5: Register routes, services, and cache invalidation**

Use cache keys:

```ts
catalogueList: "catalogue:list",
catalogueSlug: (slug: string) => `catalogue:slug:${slug}`,
```

- [ ] **Step 6: Run repository, service, and route tests**

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/repositories/catalogue.repository.test.ts \
  src/services/catalogue.service.test.ts \
  src/routes/v1/catalogue.routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): expose curated public catalogue"
```

---

### Task 4: Add Chinese-admin catalogue management APIs

**Files:**
- Create: `apps/api/src/services/admin/catalogue.admin.service.ts`
- Create: `apps/api/src/services/admin/catalogue.admin.service.test.ts`
- Create: `apps/api/src/routes/v1/admin/catalogue.routes.ts`
- Create: `apps/api/src/routes/v1/admin/catalogue.routes.test.ts`
- Modify: `apps/api/src/plugins/services.ts`
- Modify: `apps/api/src/routes/v1/admin/index.ts`
- Modify: `apps/api/src/repositories/catalogue.repository.ts`

**Interfaces:**
- Produces:
  - `adminCatalogue.list()`
  - `adminCatalogue.getById(id)`
  - `adminCatalogue.create(input)`
  - `adminCatalogue.update(id, input)`
- Consumes: catalogue repository and cache invalidation

- [ ] **Step 1: Write failing admin validation tests**

Test:

- both English and Chinese names/descriptions/durations are required;
- slug conflicts return `409`;
- every linked project ID must exist;
- inspiration images require source URL, licence URL, and bilingual attribution;
- YezYY images do not require external attribution;
- setting `published=true` requires a valid price-bearing operational project;
- `bookable` remains unchanged after publication updates.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/admin/catalogue.admin.service.test.ts
```

Expected: FAIL because `adminCatalogue` does not exist.

- [ ] **Step 3: Implement validated service inputs**

Use:

```ts
type CatalogueAdminInput = {
  categoryId: string;
  name: LocalizedString;
  slug: string;
  description: LocalizedString;
  durationDisplay: LocalizedString;
  occasionTags: LocalizedString[];
  availabilityNote: LocalizedString;
  published: boolean;
  featured: boolean;
  sortOrder: number;
  coverImageUrl: string | null;
  imageKind: "yezyy" | "inspiration" | "placeholder";
  imageSourceUrl: string | null;
  imageLicenseUrl: string | null;
  imageAttribution: LocalizedString | null;
  variants: Array<{
    projectId: string;
    label: LocalizedString | null;
    sortOrder: number;
  }>;
};
```

Create/update the catalogue entry and junction rows in one database transaction.

- [ ] **Step 4: Add protected admin routes**

Register:

- `GET /api/v1/admin/catalogue`
- `GET /api/v1/admin/catalogue/:id`
- `POST /api/v1/admin/catalogue`
- `PATCH /api/v1/admin/catalogue/:id`

Do not add destructive public-delete behaviour in this phase. Staff hides entries with `published=false`.

- [ ] **Step 5: Run admin tests**

Run:

```bash
corepack pnpm --filter @yezz/api test -- \
  src/services/admin/catalogue.admin.service.test.ts \
  src/routes/v1/admin/catalogue.routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(admin): manage public catalogue entries"
```

---

### Task 5: Add web catalogue types, mappers, and loaders

**Files:**
- Modify: `apps/web/lib/api/types.ts`
- Modify: `apps/web/lib/api/client.ts`
- Modify: `apps/web/lib/api/mappers.ts`
- Create: `apps/web/lib/catalogue/data.ts`
- Create: `apps/web/lib/catalogue/data.test.ts`

**Interfaces:**
- Produces:
  - `ApiCatalogueEntry`
  - `fetchCatalogue()`
  - `fetchCatalogueBySlug(slug)`
  - `mapCatalogueEntryFromApi(entry)`
  - `loadCataloguePageData()`
  - `loadCatalogueEntry(slug)`

- [ ] **Step 1: Write failing mapper and loader tests**

Assert:

```ts
expect(mapCatalogueEntryFromApi(apiEntry)).toMatchObject({
  slug: { current: "plaster-painting" },
  priceDisplay: "A$19.80–A$54.00",
  variants: [
    { slug: "paint-clay-figurine-mini" },
    { slug: "paint-clay-figurine-small" },
    { slug: "paint-clay-figurine-medium" },
    { slug: "paint-clay-figurine-large" },
  ],
});
```

Also test:

- API failure returns `loadFailed()`;
- a missing detail returns `loadOk(null)`;
- public category sorting is stable.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
corepack pnpm --filter @yezz/web test -- apps/web/lib/catalogue/data.test.ts
```

Expected: FAIL because the catalogue loader does not exist.

- [ ] **Step 3: Implement API types and mapping**

Map API image provenance without dropping fields. Preserve operational `projectId` on every variant for future booking selection.

- [ ] **Step 4: Implement resilient loaders**

Follow the existing `LoadResult` pattern:

```ts
export async function loadCataloguePageData(): Promise<
  LoadResult<CatalogueEntryView[]>
> {
  if (!isApiEnabled()) return loadFailed();
  try {
    return loadOk((await fetchCatalogue()).map(mapCatalogueEntryFromApi));
  } catch {
    return loadFailed();
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
corepack pnpm --filter @yezz/web test -- apps/web/lib/catalogue/data.test.ts
corepack pnpm --filter @yezz/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib
git commit -m "feat(web): load curated public catalogue"
```

---

### Task 6: Build the public catalogue experience

**Files:**
- Create: `apps/web/components/catalogue/CatalogueCategoryGrid.tsx`
- Create: `apps/web/components/catalogue/CatalogueCategoryGrid.test.tsx`
- Create: `apps/web/components/catalogue/CatalogueSection.tsx`
- Create: `apps/web/components/catalogue/CatalogueSection.test.tsx`
- Create: `apps/web/components/catalogue/CatalogueCard.tsx`
- Create: `apps/web/components/catalogue/CatalogueCard.test.tsx`
- Create: `apps/web/components/catalogue/CatalogueDetail.tsx`
- Create: `apps/web/components/catalogue/CatalogueDetail.test.tsx`
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: `apps/web/app/[locale]/page.test.tsx`
- Modify: `apps/web/app/[locale]/projects/page.tsx`
- Modify: `apps/web/app/[locale]/projects/page.test.tsx`
- Modify: `apps/web/app/[locale]/projects/[slug]/page.tsx`
- Modify: `apps/web/components/public/EditorialImage.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Consumes: `CatalogueEntryView[]`, `CatalogueEntryView`, closed request capabilities
- Produces: homepage category entrances, editorial catalogue sections, grouped detail pages

- [ ] **Step 1: Write failing public component tests**

Test these exact behaviours:

- homepage renders four categories in the approved order;
- projects page renders only published catalogue entries;
- Plaster Painting renders one card, not four cards;
- Plaster detail renders all four sizes and prices;
- Beading detail renders all five variant prices;
- Melty Beads renders the hourly and extra-time prices;
- inspiration images render `DIY inspiration` and a source link;
- YezYY images do not render an inspiration claim;
- unavailable requests render `RequestContactFallback`;
- no Book, Add to Cart, or party request controls appear while capabilities are false.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
corepack pnpm --filter @yezz/web test -- apps/web/components/catalogue
```

Expected: FAIL because catalogue components do not exist.

- [ ] **Step 3: Implement homepage category entrances**

Render exactly four category links with the warm rose/white YezYY visual system. Each link targets:

```ts
`/${locale}/projects#${category.slug.current}`
```

- [ ] **Step 4: Implement curated project sections and cards**

Cards display:

- localized name;
- derived price display;
- localized duration;
- at most three occasion tags;
- availability note;
- truthful image disclosure.

Do not render operational `bookable` as a public CTA.

- [ ] **Step 5: Implement grouped project detail**

Use a semantic fact rail:

```tsx
<dl data-testid="catalogue-fact-rail">
  <div>
    <dt>{t("price")}</dt>
    <dd>{entry.priceDisplay}</dd>
  </div>
  <div>
    <dt>{t("duration")}</dt>
    <dd>{entry.durationDisplay[locale]}</dd>
  </div>
</dl>
```

Render variants as a non-purchasing selection guide while gates are closed.

- [ ] **Step 6: Update bilingual messages**

Add complete English and Chinese copy for:

- category introductions;
- `AUD · Pay in store`;
- material availability;
- more bases available in store;
- inspiration-image disclosure;
- variant headings;
- occasion tags.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```bash
corepack pnpm --filter @yezz/web test -- \
  apps/web/components/catalogue \
  'apps/web/app/[locale]/page.test.tsx' \
  'apps/web/app/[locale]/projects/page.test.tsx'
corepack pnpm --filter @yezz/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app apps/web/components apps/web/lib/i18n
git commit -m "feat(public): launch curated DIY catalogue"
```

---

### Task 7: Add Chinese-admin catalogue screens

**Files:**
- Create: `apps/web/app/admin/catalogue/page.tsx`
- Create: `apps/web/app/admin/catalogue/page.test.tsx`
- Create: `apps/web/app/admin/catalogue/new/page.tsx`
- Create: `apps/web/app/admin/catalogue/[id]/edit/page.tsx`
- Create: `apps/web/components/admin/CatalogueForm.tsx`
- Create: `apps/web/components/admin/CatalogueForm.test.tsx`
- Modify: `apps/web/lib/admin/types.ts`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: admin catalogue API from Task 4
- Produces: publication, ordering, bilingual copy, variant links, and provenance controls

- [ ] **Step 1: Write failing admin UI tests**

Test:

- the list shows `已发布` and `已隐藏`;
- form requires English and Chinese content;
- switching image kind to `灵感图` reveals source, licence, and attribution fields;
- publication and featured controls are independent;
- linked operational projects are multi-selectable;
- saving never sends a `bookable` field.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
corepack pnpm --filter @yezz/web test -- \
  apps/web/components/admin/CatalogueForm.test.tsx \
  apps/web/app/admin/catalogue/page.test.tsx
```

Expected: FAIL because the admin catalogue UI does not exist.

- [ ] **Step 3: Add admin types and API calls**

Add:

```ts
export type CatalogueFormInput = {
  categoryId: string;
  name: LocalizedString;
  slug: string;
  description: LocalizedString;
  durationDisplay: LocalizedString;
  occasionTags: LocalizedString[];
  availabilityNote: LocalizedString;
  published: boolean;
  featured: boolean;
  sortOrder: number;
  coverImageUrl: string | null;
  imageKind: "yezyy" | "inspiration" | "placeholder";
  imageSourceUrl: string | null;
  imageLicenseUrl: string | null;
  imageAttribution: LocalizedString | null;
  variants: Array<{
    projectId: string;
    label: LocalizedString | null;
    sortOrder: number;
  }>;
};
```

- [ ] **Step 4: Implement the Chinese list and form**

Use existing admin primitives. The form must present these sections:

1. 基本信息
2. 中英文介绍
3. 公开价格来源项目
4. 公开排序与状态
5. 图片与来源

The submit payload must omit unrelated operational fields.

- [ ] **Step 5: Run UI tests and typecheck**

Run:

```bash
corepack pnpm --filter @yezz/web test -- \
  apps/web/components/admin/CatalogueForm.test.tsx \
  apps/web/app/admin/catalogue/page.test.tsx
corepack pnpm --filter @yezz/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/admin apps/web/components/admin apps/web/lib/admin
git commit -m "feat(admin): add catalogue publishing controls"
```

---

### Task 8: Verify, seed production safely, and deploy

**Files:**
- Modify only if verification exposes defects in catalogue-owned files.

**Interfaces:**
- Consumes: all prior tasks
- Produces: verified production catalogue with all request gates closed

- [ ] **Step 1: Run database tests with an isolated PostgreSQL database**

Run the dedicated database integration command added in Task 2. Confirm:

- nine public entries;
- stable operational project IDs;
- no duplicate links;
- `bookable` unchanged.

- [ ] **Step 2: Run the complete verification set**

Run:

```bash
corepack pnpm --filter @yezz/web test
corepack pnpm --filter @yezz/web typecheck
corepack pnpm --filter @yezz/web lint
corepack pnpm --filter @yezz/api test
corepack pnpm --filter @yezz/api typecheck
corepack pnpm --filter @yezz/web build
corepack pnpm test:e2e:closure
```

Expected: every command exits `0`; closure reports all desktop and mobile tests passing.

- [ ] **Step 3: Perform real visual checks**

Check at 390×844 and desktop:

- `/en`
- `/zh`
- `/en/projects`
- `/zh/projects`
- `/en/projects/plaster-painting`
- `/zh/projects/plaster-painting`
- `/en/projects/beading`

Verify no horizontal overflow, readable price rows, correct bilingual labels, visible inspiration disclosure, and no enabled request controls.

- [ ] **Step 4: Apply production migration and catalogue seed**

Use the existing production migration and bootstrap safety mechanisms. Before applying:

- resolve the exact production database target without printing credentials;
- confirm the migration is additive;
- confirm the seed preserves admin publication overrides and uploaded images.

After applying, query counts and boolean states only:

```sql
select count(*) from catalogue_entries;
select count(*) from catalogue_entry_projects;
select published, count(*) from catalogue_entries group by published;
select bookable, count(*) from diy_projects group by bookable;
```

Expected:

- nine seeded catalogue entries;
- all expected project links;
- request/bookable state unchanged.

- [ ] **Step 5: Recheck production request capabilities**

Confirm rendered production state contains:

```json
{
  "experience": false,
  "product": false,
  "party": false
}
```

Also confirm `/en/book`, `/en/cart`, and `/en/parties` expose no submission form.

- [ ] **Step 6: Publish and verify the exact commit**

Push only reviewed catalogue commits. Confirm the deployed pages contain a unique catalogue marker from the current commit, then repeat the 390px checks against `https://yezyy.com`.

- [ ] **Step 7: Route any discovered defect back to its owning task**

Do not create a catch-all verification commit. If verification finds a defect, reopen
the task that owns the affected file, add or update its focused failing test, apply the
smallest correction, repeat that task's verification commands, and use that task's
explicit staging list and commit message.
