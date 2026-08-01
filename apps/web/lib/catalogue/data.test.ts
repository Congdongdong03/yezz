import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/base";

const {
  fetchCatalogueMock,
  fetchCatalogueBySlugMock,
  isApiEnabledMock,
} = vi.hoisted(() => ({
  fetchCatalogueMock: vi.fn(),
  fetchCatalogueBySlugMock: vi.fn(),
  isApiEnabledMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  fetchCatalogue: fetchCatalogueMock,
  fetchCatalogueBySlug: fetchCatalogueBySlugMock,
}));

vi.mock("@/lib/api/config", () => ({
  isApiEnabled: isApiEnabledMock,
}));

import {
  loadCatalogueEntry,
  loadCataloguePageData,
  mapCatalogueEntryFromApi,
} from "./data";

const plasterEntry = {
  id: "plaster-entry",
  slug: "plaster-painting",
  name: { en: "Plaster Painting", zh: "石膏彩绘" },
  description: { en: "Paint a plaster figurine.", zh: "彩绘石膏公仔。" },
  durationDisplay: { en: "About 1 hour", zh: "约 1 小时" },
  occasionTags: [{ en: "Creative time", zh: "创意时光" }],
  availabilityNote: {
    en: "Materials vary in store.",
    zh: "材料与款式以门店实际为准。",
  },
  featured: true,
  sortOrder: 0,
  coverImageUrl: "https://images.example.com/plaster.jpg",
  image: {
    kind: "inspiration" as const,
    sourceUrl: "https://unsplash.com/photos/plaster",
    licenseUrl: "https://unsplash.com/license",
    attribution: { en: "Unsplash", zh: "Unsplash" },
  },
  category: {
    id: "plaster",
    name: { en: "Plaster Painting", zh: "石膏彩绘" },
    slug: "paint-clay",
    icon: "palette",
    sortOrder: 1,
  },
  variants: [
    "mini",
    "small",
    "medium",
    "large",
  ].map((size, sortOrder) => ({
    projectId: `plaster-${size}`,
    slug: `paint-clay-figurine-${size}`,
    name: { en: size, zh: size },
    label: null,
    priceDisplay: "A$19.80",
    bookable: false,
    sortOrder,
  })),
  priceDisplay: "A$19.80–A$54.00",
};

describe("public catalogue mapping and loading", () => {
  beforeEach(() => {
    isApiEnabledMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps grouped Plaster Painting variants and complete image provenance", () => {
    expect(mapCatalogueEntryFromApi(plasterEntry)).toMatchObject({
      slug: { current: "plaster-painting" },
      priceDisplay: "A$19.80–A$54.00",
      variants: [
        { slug: "paint-clay-figurine-mini", projectId: "plaster-mini" },
        { slug: "paint-clay-figurine-small", projectId: "plaster-small" },
        { slug: "paint-clay-figurine-medium", projectId: "plaster-medium" },
        { slug: "paint-clay-figurine-large", projectId: "plaster-large" },
      ],
      image: {
        kind: "inspiration",
        sourceUrl: "https://unsplash.com/photos/plaster",
        licenseUrl: "https://unsplash.com/license",
        attribution: { en: "Unsplash", zh: "Unsplash" },
      },
      category: {
        name: { en: "Plaster Painting", zh: "石膏彩绘" },
        slug: { current: "paint-clay" },
        order: 1,
      },
    });
  });

  it("sorts public catalogue entries by category and entry order", async () => {
    fetchCatalogueMock.mockResolvedValue([
      {
        ...plasterEntry,
        id: "melty-entry",
        slug: "melty-beads",
        category: {
          ...plasterEntry.category,
          id: "melty",
          slug: "melty-beads",
          sortOrder: 3,
        },
      },
      plasterEntry,
    ]);

    await expect(loadCataloguePageData()).resolves.toMatchObject({
      ok: true,
      data: [
        { slug: { current: "plaster-painting" } },
        { slug: { current: "melty-beads" } },
      ],
    });
  });

  it("fails safely when the public catalogue API is unavailable", async () => {
    fetchCatalogueMock.mockRejectedValue(new Error("offline"));

    await expect(loadCataloguePageData()).resolves.toEqual({ ok: false });
  });

  it("returns an empty detail result for a missing public slug", async () => {
    fetchCatalogueBySlugMock.mockRejectedValue(
      new ApiClientError("Not found", "NOT_FOUND", 404),
    );

    await expect(loadCatalogueEntry("missing")).resolves.toEqual({
      ok: true,
      data: null,
    });
  });
});
