import { describe, expect, it } from "vitest";
import {
  LIVE_DIY_PROJECTS,
  LIVE_PARTY_PACKAGES,
} from "./live-booking-catalogue.js";
import {
  assertLiveCatalogueSeedConfirmation,
  seedLiveBookingCatalogue,
  type LiveCatalogueSeedStore,
} from "./seed-live-booking-catalogue.js";

describe("approved live booking catalogue", () => {
  it("contains only the approved DIY services with their operational prices and durations", () => {
    expect(
      LIVE_DIY_PROJECTS.map((project) => ({
        slug: project.slug,
        priceMinCents: project.priceMinCents,
        priceMaxCents: project.priceMaxCents,
        durationMinutes: project.durationMinutes,
        variantSelectedInStore: project.variantSelectedInStore,
      })),
    ).toEqual([
      { slug: "air-dry-two-hair-clips", priceMinCents: 1800, priceMaxCents: 1800, durationMinutes: 30, variantSelectedInStore: false },
      { slug: "air-dry-fridge-magnet", priceMinCents: 1800, priceMaxCents: 1800, durationMinutes: 30, variantSelectedInStore: false },
      { slug: "air-dry-mini-drawers", priceMinCents: 3200, priceMaxCents: 3200, durationMinutes: 30, variantSelectedInStore: false },
      { slug: "air-dry-hair-claw", priceMinCents: 3200, priceMaxCents: 3200, durationMinutes: 30, variantSelectedInStore: false },
      { slug: "air-dry-car-decoration-stand", priceMinCents: 3800, priceMaxCents: 3800, durationMinutes: 30, variantSelectedInStore: false },
      { slug: "air-dry-medium-storage", priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-large-storage", priceMinCents: 9800, priceMaxCents: 9800, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-glass-dome", priceMinCents: 9800, priceMaxCents: 9800, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-extra-large-drawer", priceMinCents: 19700, priceMaxCents: 19700, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-pen-holder", priceMinCents: 5000, priceMaxCents: 5000, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-extra-face", priceMinCents: 3300, priceMaxCents: 3300, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-mug", priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-lamp", priceMinCents: 4300, priceMaxCents: 4300, durationMinutes: 60, variantSelectedInStore: true },
      { slug: "air-dry-mirror", priceMinCents: 8700, priceMaxCents: 8700, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-notebook", priceMinCents: 8700, priceMaxCents: 8700, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-pencil-case", priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-phone-case", priceMinCents: 6600, priceMaxCents: 6600, durationMinutes: 60, variantSelectedInStore: true },
      { slug: "air-dry-phone-stand", priceMinCents: 7600, priceMaxCents: 7600, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-phone-socket", priceMinCents: 3200, priceMaxCents: 3200, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-small-bag", priceMinCents: 6500, priceMaxCents: 6500, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-large-bag", priceMinCents: 10900, priceMaxCents: 10900, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "air-dry-water-bottle", priceMinCents: 8800, priceMaxCents: 8800, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "melty-bead-craft", priceMinCents: 4950, priceMaxCents: 4950, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "paint-clay-figurine-mini", priceMinCents: 1980, priceMaxCents: 1980, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "paint-clay-figurine-small", priceMinCents: 2750, priceMaxCents: 2750, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "paint-clay-figurine-medium", priceMinCents: 3850, priceMaxCents: 3850, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "paint-clay-figurine-large", priceMinCents: 5400, priceMaxCents: 5400, durationMinutes: 60, variantSelectedInStore: false },
      { slug: "beading", priceMinCents: 4300, priceMaxCents: 4300, durationMinutes: 30, variantSelectedInStore: true },
    ]);
  });

  it("retains the approved melty-bead extra time without the temporary discount", () => {
    expect(LIVE_DIY_PROJECTS.find((project) => project.slug === "melty-bead-craft")).toMatchObject({
      extraTimeMinutes: 30,
      extraTimePriceCents: 1650,
    });
    expect(JSON.stringify(LIVE_DIY_PROJECTS)).not.toMatch(/50%|half price/i);
  });

  it("defines the two approved party operations", () => {
    expect(LIVE_PARTY_PACKAGES).toMatchObject([
      { slug: "party-90", guestDurationMinutes: 90, setupMinutes: 30, cleanupMinutes: 30, venueFeeCents: 9500, minPeople: 4, maxPeople: 8, minSpendPerPersonCents: 4500 },
      { slug: "party-150", guestDurationMinutes: 150, setupMinutes: 30, cleanupMinutes: 30, venueFeeCents: 14500, minPeople: 4, maxPeople: 8, minSpendPerPersonCents: 4500 },
    ]);
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
