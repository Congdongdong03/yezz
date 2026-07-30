import { describe, expect, it } from "vitest";
import {
  DECIDE_IN_STORE_OPTION,
  LIVE_DIY_PROJECTS,
  LIVE_PARTY_PACKAGES,
  LIVE_PROJECT_CATEGORIES,
} from "./live-booking-catalogue.js";
import {
  assertLiveCatalogueSeedConfirmation,
  runLiveBookingCatalogueSeed,
  seedLiveBookingCatalogue,
  type LiveCatalogueSeedStore,
} from "./seed-live-booking-catalogue.js";

describe("approved live booking catalogue", () => {
  it("matches the complete approved DIY catalogue exactly", () => {
    expect(
      LIVE_DIY_PROJECTS.map((project) => ({
        categorySlug: project.categorySlug,
        slug: project.slug,
        name: project.name,
        priceMinCents: project.priceMinCents,
        priceMaxCents: project.priceMaxCents,
        durationMinutes: project.durationMinutes,
        variantSelectedInStore: project.variantSelectedInStore,
        extraTimeMinutes: "extraTimeMinutes" in project ? project.extraTimeMinutes : null,
        extraTimePriceCents: "extraTimePriceCents" in project ? project.extraTimePriceCents : null,
      })),
    ).toEqual([
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-two-hair-clips", name: { en: "Two hair clips", zh: "一对发夹" }, priceMinCents: 1800, priceMaxCents: 1800, durationMinutes: 30, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-fridge-magnet", name: { en: "Fridge magnet", zh: "冰箱贴" }, priceMinCents: 1800, priceMaxCents: 1800, durationMinutes: 30, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-mini-drawers", name: { en: "Mini drawers", zh: "迷你抽屉" }, priceMinCents: 3200, priceMaxCents: 3200, durationMinutes: 30, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-hair-claw", name: { en: "Hair claw", zh: "抓夹" }, priceMinCents: 3200, priceMaxCents: 3200, durationMinutes: 30, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-car-decoration-stand", name: { en: "Car decoration stand", zh: "车载摆件支架" }, priceMinCents: 3800, priceMaxCents: 3800, durationMinutes: 30, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-medium-storage", name: { en: "Medium storage box/drawers", zh: "中号收纳盒／抽屉" }, priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-large-storage", name: { en: "Large storage box/drawers", zh: "大号收纳盒／抽屉" }, priceMinCents: 9800, priceMaxCents: 9800, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-glass-dome", name: { en: "Glass dome", zh: "玻璃罩" }, priceMinCents: 9800, priceMaxCents: 9800, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-extra-large-drawer", name: { en: "Extra-large drawer", zh: "超大号抽屉" }, priceMinCents: 19700, priceMaxCents: 19700, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-pen-holder", name: { en: "Pen holder, one face", zh: "笔筒（单面）" }, priceMinCents: 5000, priceMaxCents: 5000, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-extra-face", name: { en: "Extra face", zh: "加做一面" }, priceMinCents: 3300, priceMaxCents: 3300, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-mug", name: { en: "Mug", zh: "马克杯" }, priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-lamp", name: { en: "Lamp", zh: "台灯" }, priceMinCents: 4300, priceMaxCents: 9800, durationMinutes: 60, variantSelectedInStore: true, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-mirror", name: { en: "Mirror", zh: "镜子" }, priceMinCents: 8700, priceMaxCents: 8700, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-notebook", name: { en: "Notebook", zh: "笔记本" }, priceMinCents: 8700, priceMaxCents: 8700, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-pencil-case", name: { en: "Pencil case", zh: "笔袋" }, priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-phone-case", name: { en: "Phone case", zh: "手机壳" }, priceMinCents: 6600, priceMaxCents: 7600, durationMinutes: 60, variantSelectedInStore: true, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-phone-stand", name: { en: "Phone stand", zh: "手机支架" }, priceMinCents: 7600, priceMaxCents: 7600, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-phone-socket", name: { en: "Phone socket", zh: "手机气囊支架" }, priceMinCents: 3200, priceMaxCents: 3200, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-small-bag", name: { en: "Small bag to decorate", zh: "小包（可装饰）" }, priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-large-bag", name: { en: "Large bag to decorate", zh: "大包（可装饰）" }, priceMinCents: 10900, priceMaxCents: 10900, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "air-dry-cream-piping", slug: "air-dry-water-bottle", name: { en: "Water bottle", zh: "水瓶" }, priceMinCents: 8800, priceMaxCents: 8800, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "melty-beads", slug: "melty-bead-craft", name: { en: "Melty bead craft", zh: "拼豆手作" }, priceMinCents: 4950, priceMaxCents: 4950, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: 30, extraTimePriceCents: 1650 },
      { categorySlug: "paint-clay", slug: "paint-clay-figurine-mini", name: { en: "Paint clay figurine — Mini", zh: "彩绘黏土摆件—迷你号" }, priceMinCents: 1980, priceMaxCents: 1980, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "paint-clay", slug: "paint-clay-figurine-small", name: { en: "Paint clay figurine — Small", zh: "彩绘黏土摆件—小号" }, priceMinCents: 2750, priceMaxCents: 2750, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "paint-clay", slug: "paint-clay-figurine-medium", name: { en: "Paint clay figurine — Medium", zh: "彩绘黏土摆件—中号" }, priceMinCents: 3850, priceMaxCents: 3850, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "paint-clay", slug: "paint-clay-figurine-large", name: { en: "Paint clay figurine — Large", zh: "彩绘黏土摆件—大号" }, priceMinCents: 5400, priceMaxCents: 5400, durationMinutes: 60, variantSelectedInStore: false, extraTimeMinutes: null, extraTimePriceCents: null },
      { categorySlug: "beading", slug: "beading", name: { en: "Beading — from $43", zh: "串珠—43澳元起" }, priceMinCents: 4300, priceMaxCents: 4300, durationMinutes: 30, variantSelectedInStore: true, extraTimeMinutes: null, extraTimePriceCents: null },
    ]);
  });

  it("matches every category, party package, and synthetic option exactly", () => {
    expect(LIVE_PROJECT_CATEGORIES).toEqual([
      { slug: "air-dry-cream-piping", name: { en: "Cream piping DIY", zh: "奶油胶DIY" }, sortOrder: 0 },
      { slug: "melty-beads", name: { en: "Melty beads", zh: "拼豆" }, sortOrder: 1 },
      { slug: "paint-clay", name: { en: "Paint clay", zh: "彩绘黏土" }, sortOrder: 2 },
      { slug: "beading", name: { en: "Beading", zh: "串珠" }, sortOrder: 3 },
    ]);
    expect(LIVE_PARTY_PACKAGES).toEqual([
      { slug: "party-90", name: { en: "90-minute party package", zh: "90分钟派对套餐" }, guestDurationMinutes: 90, setupMinutes: 30, cleanupMinutes: 30, venueFeeCents: 9500, minPeople: 4, maxPeople: 8, minSpendPerPersonCents: 4500, minParents: 1, maxParents: 2 },
      { slug: "party-150", name: { en: "150-minute party package", zh: "150分钟派对套餐" }, guestDurationMinutes: 150, setupMinutes: 30, cleanupMinutes: 30, venueFeeCents: 14500, minPeople: 4, maxPeople: 8, minSpendPerPersonCents: 4500, minParents: 1, maxParents: 2 },
    ]);
    expect(DECIDE_IN_STORE_OPTION).toEqual({
      name: { en: "Decide in store", zh: "到店决定" },
      priceCents: null,
      durationMinutes: 60,
    });
  });

  it("retains the approved melty-bead extra time without the temporary discount", () => {
    expect(LIVE_DIY_PROJECTS.find((project) => project.slug === "melty-bead-craft")).toMatchObject({
      extraTimeMinutes: 30,
      extraTimePriceCents: 1650,
    });
    expect(JSON.stringify(LIVE_DIY_PROJECTS)).not.toMatch(/50%|half price/i);
  });

  it("checks confirmation before dotenv can change the invocation environment", async () => {
    const env: Record<string, string | undefined> = {
      CONFIRM_LIVE_CATALOGUE_SEED: "not-YezYY",
    };
    let loaded = false;

    await expect(
      runLiveBookingCatalogueSeed(env, {
        loadEnvironment: () => {
          loaded = true;
          env.CONFIRM_LIVE_CATALOGUE_SEED = "YezYY";
        },
      }),
    ).rejects.toThrow(/CONFIRM_LIVE_CATALOGUE_SEED/);
    expect(loaded).toBe(false);
  });

  it("refuses the manual seed unless the exact confirmation is supplied", () => {
    expect(() => assertLiveCatalogueSeedConfirmation({})).toThrow(/CONFIRM_LIVE_CATALOGUE_SEED/);
    expect(() =>
      assertLiveCatalogueSeedConfirmation({ CONFIRM_LIVE_CATALOGUE_SEED: "yezYY" }),
    ).toThrow(/CONFIRM_LIVE_CATALOGUE_SEED/);
    expect(() =>
      assertLiveCatalogueSeedConfirmation({ CONFIRM_LIVE_CATALOGUE_SEED: "YezYY" }),
    ).not.toThrow();
  });

  it("upserts only stable live slugs without deleting legacy catalogue rows", async () => {
    const categoryIds = new Map<string, string>();
    const projectSlugs: string[] = [];
    const partySlugs: string[] = [];
    const store: LiveCatalogueSeedStore = {
      async upsertCategory(category) {
        const id = `category-${category.slug}`;
        categoryIds.set(category.slug, id);
        return { id };
      },
      async upsertProject(project) {
        projectSlugs.push(project.slug);
      },
      async upsertParty(party) {
        partySlugs.push(party.slug);
      },
    };

    await seedLiveBookingCatalogue(store);

    expect(categoryIds.size).toBe(4);
    expect(projectSlugs).toEqual(LIVE_DIY_PROJECTS.map((project) => project.slug));
    expect(partySlugs).toEqual(LIVE_PARTY_PACKAGES.map((party) => party.slug));
    expect(projectSlugs).not.toContain("legacy-project");
    expect(partySlugs).not.toContain("legacy-party");
  });
});
