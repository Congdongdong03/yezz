import { describe, expect, it } from "vitest";
import { mapProjectRow } from "./projects.service.js";

describe("project operational DTO", () => {
  it("returns cents pricing and booking fields for an approved project", () => {
    const result = mapProjectRow(
      {
        id: "project-1",
        name: { en: "Melty bead craft", zh: "拼豆手作" },
        slug: "melty-bead-craft",
        projectType: "experience",
        description: null,
        priceRange: "$49.50",
        priceMin: 4950,
        priceMax: 4950,
        priceCurrency: "AUD",
        duration: "60 minutes",
        durationMinutes: 60,
        bookable: false,
        variantSelectedInStore: false,
        extraTimeMinutes: 30,
        extraTimePriceCents: 1650,
        tags: [],
        sortOrder: 0,
        coverImageUrl: null,
      } as never,
      {
        id: "category-1",
        name: { en: "Melty beads", zh: "拼豆" },
        slug: "melty-beads",
        icon: null,
      } as never,
    );

    expect(result).toMatchObject({
      priceMin: 4950,
      priceMax: 4950,
      priceCurrency: "AUD",
      durationMinutes: 60,
      bookable: false,
      variantSelectedInStore: false,
      extraTimeMinutes: 30,
      extraTimePriceCents: 1650,
    });
  });

  it("keeps missing cents snapshots null even when a legacy display price exists", () => {
    const result = mapProjectRow(
      {
        id: "legacy-project",
        name: { en: "Legacy", zh: "旧项目" },
        slug: "legacy-project",
        projectType: "experience",
        description: null,
        priceRange: "$49.50",
        priceMin: null,
        priceMax: null,
        priceCurrency: "AUD",
        duration: null,
        durationMinutes: null,
        bookable: false,
        variantSelectedInStore: false,
        extraTimeMinutes: null,
        extraTimePriceCents: null,
        tags: [],
        sortOrder: 0,
        coverImageUrl: null,
      } as never,
      {
        id: "category-1",
        name: { en: "Legacy", zh: "旧分类" },
        slug: "legacy",
        icon: null,
      } as never,
    );

    expect(result).toMatchObject({
      priceMin: null,
      priceMax: null,
      priceDisplay: "$49.50",
      priceCurrency: "AUD",
    });
  });
});
