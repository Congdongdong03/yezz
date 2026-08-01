import type {
  catalogueEntries,
  catalogueEntryProjects,
  diyProjects,
  LocalizedString,
  projectCategories,
  Db,
} from "@yezz/db";
import type Redis from "ioredis";
import { CACHE_KEYS, cacheGet, cacheSet } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { resolveProjectPricing } from "../lib/pricing.js";
import { createCatalogueRepository } from "../repositories/catalogue.repository.js";
import type { CategorySummaryDto } from "./projects.service.js";

export type CatalogueVariantDto = {
  projectId: string;
  slug: string;
  name: LocalizedString;
  label: LocalizedString | null;
  priceDisplay: string | null;
  bookable: boolean;
  sortOrder: number;
  extraTimeMinutes: number | null;
  extraTimePriceCents: number | null;
};

export type CatalogueEntryDto = {
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

type CatalogueRow = {
  catalogueEntry: typeof catalogueEntries.$inferSelect;
  projectCategory: typeof projectCategories.$inferSelect;
  association: typeof catalogueEntryProjects.$inferSelect | null;
  project: typeof diyProjects.$inferSelect | null;
};

type CatalogueRepository = {
  findPublishedWithVariants(): Promise<CatalogueRow[]>;
  findPublishedBySlugWithVariants(slug: string): Promise<CatalogueRow[]>;
};

type PricedVariant = CatalogueVariantDto & {
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
};

export type CatalogueService = ReturnType<typeof createCatalogueService>;

function formatOperationalPrice(
  priceMin: number | null,
  priceMax: number | null,
  priceCurrency: string,
): string | null {
  if (priceMin == null && priceMax == null) return null;

  const prefix = priceCurrency === "AUD" ? "A$" : `${priceCurrency} `;
  const format = (value: number) => `${prefix}${value.toFixed(2)}`;
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return `${format(priceMin)}–${format(priceMax)}`;
  }
  return format(priceMin ?? priceMax!);
}

function mapVariant(
  association: NonNullable<CatalogueRow["association"]>,
  project: NonNullable<CatalogueRow["project"]>,
): PricedVariant {
  // Project prices are stored as cents. Resolve the operational pricing record
  // before formatting it for this public, AUD-only catalogue presentation.
  const pricing = resolveProjectPricing({
    priceRange: null,
    priceMin: project.priceMin == null ? null : project.priceMin / 100,
    priceMax: project.priceMax == null ? null : project.priceMax / 100,
    priceCurrency: project.priceCurrency,
  });

  return {
    projectId: project.id,
    slug: project.slug,
    name: project.name,
    label: association.label ?? null,
    priceDisplay: formatOperationalPrice(
      pricing.priceMin,
      pricing.priceMax,
      pricing.priceCurrency,
    ),
    bookable: project.bookable,
    sortOrder: association.sortOrder,
    extraTimeMinutes: project.extraTimeMinutes ?? null,
    extraTimePriceCents: project.extraTimePriceCents ?? null,
    priceMin: pricing.priceMin,
    priceMax: pricing.priceMax,
    priceCurrency: pricing.priceCurrency,
  };
}

function mapRows(rows: CatalogueRow[]): CatalogueEntryDto[] {
  const grouped = new Map<
    string,
    {
      entry: CatalogueRow["catalogueEntry"];
      category: CatalogueRow["projectCategory"];
      variants: PricedVariant[];
    }
  >();

  for (const row of rows) {
    // The repository is the security boundary. Keep this guard so a future
    // alternative repository cannot accidentally expose a private entry.
    if (!row.catalogueEntry.published) continue;

    const current = grouped.get(row.catalogueEntry.id) ?? {
      entry: row.catalogueEntry,
      category: row.projectCategory,
      variants: [],
    };
    if (row.association && row.project) {
      current.variants.push(mapVariant(row.association, row.project));
    }
    grouped.set(row.catalogueEntry.id, current);
  }

  return [...grouped.values()]
    .sort(
      (a, b) =>
        a.category.sortOrder - b.category.sortOrder ||
        a.entry.sortOrder - b.entry.sortOrder,
    )
    .map(({ entry, category, variants }) => {
      const orderedVariants = variants.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      const priceMin = orderedVariants.reduce<number | null>(
        (lowest, variant) =>
          variant.priceMin == null
            ? lowest
            : lowest == null
              ? variant.priceMin
              : Math.min(lowest, variant.priceMin),
        null,
      );
      const priceMax = orderedVariants.reduce<number | null>(
        (highest, variant) =>
          variant.priceMax == null
            ? highest
            : highest == null
              ? variant.priceMax
              : Math.max(highest, variant.priceMax),
        null,
      );
      const currency = orderedVariants[0]?.priceCurrency ?? "AUD";

      return {
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        durationDisplay: entry.durationDisplay,
        occasionTags: entry.occasionTags,
        availabilityNote: entry.availabilityNote,
        featured: entry.featured,
        sortOrder: entry.sortOrder,
        coverImageUrl: entry.coverImageUrl ?? null,
        image: {
          kind: entry.imageKind,
          sourceUrl: entry.imageSourceUrl ?? null,
          licenseUrl: entry.imageLicenseUrl ?? null,
          attribution: entry.imageAttribution ?? null,
        },
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          icon: category.icon ?? null,
        },
        variants: orderedVariants.map(
          ({
            priceMin: _priceMin,
            priceMax: _priceMax,
            priceCurrency: _priceCurrency,
            ...variant
          }) => variant,
        ),
        priceDisplay: formatOperationalPrice(priceMin, priceMax, currency),
      };
    });
}

export function createCatalogueService(
  db: Db,
  redis: Redis | null = null,
  dependencies?: { repository?: CatalogueRepository },
) {
  const repository = dependencies?.repository ?? createCatalogueRepository(db);

  return {
    async list(): Promise<CatalogueEntryDto[]> {
      const cached = await cacheGet<CatalogueEntryDto[]>(
        redis,
        CACHE_KEYS.catalogueList,
      );
      if (cached) return cached;

      const result = mapRows(await repository.findPublishedWithVariants());
      await cacheSet(redis, CACHE_KEYS.catalogueList, result);
      return result;
    },

    async getBySlug(slug: string): Promise<CatalogueEntryDto> {
      const cacheKey = CACHE_KEYS.catalogueSlug(slug);
      const cached = await cacheGet<CatalogueEntryDto>(redis, cacheKey);
      if (cached) return cached;

      const [result] = mapRows(
        await repository.findPublishedBySlugWithVariants(slug),
      );
      if (!result) {
        throw new AppError(
          404,
          "NOT_FOUND",
          `Catalogue entry not found: ${slug}`,
        );
      }

      await cacheSet(redis, cacheKey, result);
      return result;
    },
  };
}
