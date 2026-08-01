import { describe, expect, it } from "vitest";
import { createCatalogueService } from "./catalogue.service.js";

const category = {
  id: "category-1",
  name: { en: "Paint clay", zh: "彩绘黏土" },
  slug: "paint-clay",
  icon: "palette",
  sortOrder: 1,
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    categoryId: category.id,
    name: { en: "Plaster Painting", zh: "石膏彩绘" },
    slug: "plaster-painting",
    description: { en: "Paint a figurine.", zh: "彩绘摆件。" },
    durationDisplay: { en: "About 1 hour", zh: "约 1 小时" },
    occasionTags: [{ en: "Family activity", zh: "亲子活动" }],
    availabilityNote: { en: "Styles vary.", zh: "款式以店内为准。" },
    published: true,
    featured: true,
    sortOrder: 0,
    coverImageUrl: "https://images.example/plaster.jpg",
    imageKind: "inspiration",
    imageSourceUrl: "https://source.example/plaster",
    imageLicenseUrl: "https://license.example",
    imageAttribution: { en: "Example", zh: "示例" },
    ...overrides,
  };
}

function project(
  slug: string,
  priceMin: number,
  priceMax = priceMin,
  sortOrder = 0,
  extraTimeMinutes: number | null = null,
  extraTimePriceCents: number | null = null,
) {
  return {
    id: `project-${slug}`,
    slug,
    name: { en: slug, zh: slug },
    priceRange: "legacy display price that must not be parsed",
    priceMin,
    priceMax,
    priceCurrency: "AUD",
    projectType: "experience",
    bookable: false,
    durationMinutes: 60,
    sortOrder,
    extraTimeMinutes,
    extraTimePriceCents,
  };
}

function row(
  projectRow = project("mini", 1980),
  overrides: {
    catalogueEntry?: Record<string, unknown>;
    projectCategory?: Record<string, unknown>;
    associationSortOrder?: number;
  } = {},
) {
  return {
    catalogueEntry: entry(overrides.catalogueEntry),
    projectCategory: { ...category, ...overrides.projectCategory },
    association: {
      catalogueEntryId: "entry-1",
      projectId: projectRow.id,
      label: null,
      sortOrder: overrides.associationSortOrder ?? projectRow.sortOrder,
    },
    project: projectRow,
  };
}

function service(rows: ReturnType<typeof row>[]) {
  return createCatalogueService(null as never, null, {
    repository: {
      findPublishedWithVariants: async () => rows,
      findPublishedBySlugWithVariants: async (slug: string) =>
        rows.filter(({ catalogueEntry }) => catalogueEntry.slug === slug),
    } as never,
  });
}

describe("public catalogue service", () => {
  it("never returns unpublished entries", async () => {
    const result = await service([
      row(project("public", 1800)),
      row(project("private", 3200), {
        catalogueEntry: {
          id: "entry-private",
          slug: "private",
          published: false,
        },
      }),
    ]).list();

    expect(result.map((item) => item.slug)).toEqual(["plaster-painting"]);
  });

  it("sorts entries by category order then catalogue sort order", async () => {
    const result = await service([
      row(project("later", 1800), {
        catalogueEntry: { id: "entry-later", slug: "later", sortOrder: 2 },
        projectCategory: { sortOrder: 1 },
      }),
      row(project("first", 1800), {
        catalogueEntry: { id: "entry-first", slug: "first", sortOrder: 1 },
        projectCategory: { sortOrder: 0 },
      }),
      row(project("middle", 1800), {
        catalogueEntry: { id: "entry-middle", slug: "middle", sortOrder: 1 },
        projectCategory: { sortOrder: 1 },
      }),
    ]).list();

    expect(result.map((item) => item.slug)).toEqual([
      "first",
      "middle",
      "later",
    ]);
  });

  it("groups Plaster Painting into four sorted variants with an operational price range", async () => {
    const result = await service([
      row(project("large", 5400), { associationSortOrder: 3 }),
      row(project("mini", 1980), { associationSortOrder: 0 }),
      row(project("medium", 3850), { associationSortOrder: 2 }),
      row(project("small", 2750), { associationSortOrder: 1 }),
    ]).getBySlug("plaster-painting");

    expect(result.variants.map((variant) => variant.slug)).toEqual([
      "mini",
      "small",
      "medium",
      "large",
    ]);
    expect(result.priceDisplay).toBe("A$19.80–A$54.00");
  });

  it("uses operational project cents for a one-variant price", async () => {
    const result = await service([row(project("two-hair-clips", 1800))]).list();

    expect(result[0]?.priceDisplay).toBe("A$18.00");
    expect(result[0]?.variants[0]?.priceDisplay).toBe("A$18.00");
  });

  it("keeps an operational extra-time price available for Melty Beads", async () => {
    const result = await service([
      row(project("melty-bead-craft", 4950, 4950, 0, 30, 1650)),
    ]).list();

    expect(result[0]?.variants[0]).toMatchObject({
      extraTimeMinutes: 30,
      extraTimePriceCents: 1650,
    });
  });

  it("only marks supported experience variants as eligible for ordinary booking", async () => {
    const eligible = project("eligible-experience", 4300);
    eligible.bookable = true;
    const product = {
      ...project("product", 4300),
      bookable: true,
      projectType: "product",
    };
    const unsupportedDuration = {
      ...project("unsupported-duration", 4300),
      bookable: true,
      durationMinutes: 90,
    };

    const result = await service([
      row(eligible),
      row(product),
      row(unsupportedDuration),
    ]).list();

    expect(
      result[0]?.variants.map(({ slug, bookingEligible }) => ({
        slug,
        bookingEligible,
      })),
    ).toEqual([
      { slug: "eligible-experience", bookingEligible: true },
      { slug: "product", bookingEligible: false },
      { slug: "unsupported-duration", bookingEligible: false },
    ]);
  });

  it("returns NOT_FOUND for a missing published slug", async () => {
    await expect(service([]).getBySlug("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });

  it("preserves image provenance", async () => {
    const result = await service([row()]).getBySlug("plaster-painting");

    expect(result.image).toEqual({
      kind: "inspiration",
      sourceUrl: "https://source.example/plaster",
      licenseUrl: "https://license.example",
      attribution: { en: "Example", zh: "示例" },
    });
  });
});
