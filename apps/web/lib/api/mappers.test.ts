import { describe, expect, it } from "vitest";
import {
  mapPartyFromApi,
  mapProjectListItemFromApi,
  mapSiteSettingsFromApi,
} from "./mappers";
import type { ApiParty, ApiProjectListItem, ApiSiteSettings } from "./types";

const settings: Omit<ApiSiteSettings, "requestCapabilities"> = {
  id: "settings",
  storeName: "YezYY",
  address: null,
  businessHours: null,
  phone: null,
  email: null,
  wechatId: null,
  wechatQrUrl: null,
  heroImageUrl: null,
  instagram: null,
  xiaohongshu: null,
  googleMapUrl: null,
  seoTitle: null,
  seoDescription: null,
};

describe("mapSiteSettingsFromApi", () => {
  it("fails every request capability closed when rollout data is absent", () => {
    const result = mapSiteSettingsFromApi(
      settings as ApiSiteSettings,
    );

    expect(result.requestCapabilities).toEqual({
      experience: false,
      product: false,
      party: false,
    });
  });

  it("accepts only literal boolean true capability values", () => {
    const result = mapSiteSettingsFromApi({
      ...settings,
      requestCapabilities: {
        experience: true,
        product: "true",
        party: 1,
      },
    } as unknown as ApiSiteSettings);

    expect(result.requestCapabilities).toEqual({
      experience: true,
      product: false,
      party: false,
    });
  });
});

describe("live booking catalogue mappings", () => {
  it("keeps project cents pricing and operational fields available to the web app", () => {
    const result = mapProjectListItemFromApi({
      id: "project-1",
      name: { en: "Melty bead craft", zh: "拼豆手作" },
      slug: "melty-bead-craft",
      projectType: "experience",
      description: null,
      priceRange: "$49.50",
      priceMin: 4950,
      priceMax: 4950,
      priceCurrency: "AUD",
      priceDisplay: "$49.50",
      duration: "60 minutes",
      durationMinutes: 60,
      bookable: false,
      variantSelectedInStore: false,
      extraTimeMinutes: 30,
      extraTimePriceCents: 1650,
      tags: [],
      sortOrder: 0,
      coverImageUrl: null,
      category: {
        id: "category-1",
        name: { en: "Melty beads", zh: "拼豆" },
        slug: "melty-beads",
        icon: null,
      },
    } as ApiProjectListItem);

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

  it("keeps party timing and fee snapshots available to the web app", () => {
    const result = mapPartyFromApi({
      id: "party-1",
      name: { en: "90-minute party package", zh: "90分钟派对套餐" },
      slug: "party-90",
      description: null,
      includes: [],
      imageUrl: null,
      imageUrls: [],
      minPeople: 4,
      maxPeople: 8,
      priceIndicator: null,
      guestDurationMinutes: 90,
      setupMinutes: 30,
      cleanupMinutes: 30,
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
      minParents: 1,
      maxParents: 2,
      tags: [],
      sortOrder: 0,
    } as ApiParty);

    expect(result).toMatchObject({
      guestDurationMinutes: 90,
      setupMinutes: 30,
      cleanupMinutes: 30,
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
      minParents: 1,
      maxParents: 2,
    });
  });
});
