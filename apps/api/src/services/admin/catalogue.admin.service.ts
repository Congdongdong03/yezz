import type {
  catalogueEntries,
  catalogueEntryProjects,
  diyProjects,
  LocalizedString,
  projectCategories,
  Db,
} from "@yezz/db";
import type Redis from "ioredis";
import { invalidateCatalogueCache } from "../../lib/cache.js";
import { AppError } from "../../lib/errors.js";
import {
  createCatalogueRepository,
  type CatalogueEntryWriteInput,
  type CatalogueRepository,
} from "../../repositories/catalogue.repository.js";

export type CatalogueAdminInput = CatalogueEntryWriteInput & {
  variants: Array<{
    projectId: string;
    label: LocalizedString | null;
    sortOrder: number;
  }>;
};

export type AdminCatalogueEntryDto = {
  id: string;
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
  image: {
    kind: "yezyy" | "inspiration" | "placeholder";
    sourceUrl: string | null;
    licenseUrl: string | null;
    attribution: LocalizedString | null;
  };
  category: {
    id: string;
    name: LocalizedString;
    slug: string;
    icon: string | null;
    sortOrder: number;
  };
  variants: Array<{
    projectId: string;
    label: LocalizedString | null;
    sortOrder: number;
    slug: string;
    name: LocalizedString;
    priceMin: number | null;
    priceMax: number | null;
    priceCurrency: string | null;
    bookable: boolean;
  }>;
};

type CatalogueRow = {
  catalogueEntry: typeof catalogueEntries.$inferSelect;
  projectCategory: typeof projectCategories.$inferSelect;
  association: typeof catalogueEntryProjects.$inferSelect | null;
  project: typeof diyProjects.$inferSelect | null;
};

type TransactionRunner = <Result>(
  operation: (transaction: Db) => Promise<Result>,
) => Promise<Result>;

type AdminCatalogueDependencies = {
  repository?: CatalogueRepository;
  transaction?: TransactionRunner;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function databaseErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

function validationError(message: string): never {
  throw new AppError(400, "VALIDATION_ERROR", message);
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    validationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") validationError(`${field} must be a string`);
  return value;
}

function asNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return asString(value, field);
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") validationError(`${field} must be a boolean`);
  return value;
}

function asInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    validationError(`${field} must be an integer`);
  }
  return value;
}

function asUuid(value: unknown, field: string): string {
  const id = asString(value, field);
  if (!UUID_PATTERN.test(id)) validationError(`${field} must be a UUID`);
  return id.toLowerCase();
}

function asLocalizedString(value: unknown, field: string): LocalizedString {
  const localized = asRecord(value, field);
  const en = asString(localized.en, `${field}.en`);
  const zh = asString(localized.zh, `${field}.zh`);
  if (!en.trim() || !zh.trim()) validationError(`${field} requires en and zh`);
  return { en, zh };
}

function asLocalizedStringOrNull(
  value: unknown,
  field: string,
): LocalizedString | null {
  return value === null ? null : asLocalizedString(value, field);
}

function parseInput(value: unknown): CatalogueAdminInput {
  const input = asRecord(value, "body");
  const occasionTags = input.occasionTags;
  const variants = input.variants;
  if (!Array.isArray(occasionTags) || !Array.isArray(variants)) {
    validationError("occasionTags and variants must be arrays");
  }
  const imageKind = asString(input.imageKind, "imageKind");
  if (imageKind !== "yezyy" && imageKind !== "inspiration" && imageKind !== "placeholder") {
    validationError("imageKind is invalid");
  }
  return {
    categoryId: asUuid(input.categoryId, "categoryId"),
    name: asLocalizedString(input.name, "name"),
    slug: asString(input.slug, "slug"),
    description: asLocalizedString(input.description, "description"),
    durationDisplay: asLocalizedString(input.durationDisplay, "durationDisplay"),
    occasionTags: occasionTags.map((tag, index) =>
      asLocalizedString(tag, `occasionTags[${index}]`),
    ),
    availabilityNote: asLocalizedString(input.availabilityNote, "availabilityNote"),
    published: asBoolean(input.published, "published"),
    featured: asBoolean(input.featured, "featured"),
    sortOrder: asInteger(input.sortOrder, "sortOrder"),
    coverImageUrl: asNullableString(input.coverImageUrl, "coverImageUrl"),
    imageKind,
    imageSourceUrl: asNullableString(input.imageSourceUrl, "imageSourceUrl"),
    imageLicenseUrl: asNullableString(input.imageLicenseUrl, "imageLicenseUrl"),
    imageAttribution: asLocalizedStringOrNull(
      input.imageAttribution,
      "imageAttribution",
    ),
    variants: variants.map((variant, index) => {
      const candidate = asRecord(variant, `variants[${index}]`);
      return {
        projectId: asUuid(candidate.projectId, `variants[${index}].projectId`),
        label: asLocalizedStringOrNull(candidate.label, `variants[${index}].label`),
        sortOrder: asInteger(candidate.sortOrder, `variants[${index}].sortOrder`),
      };
    }),
  };
}

function hasLocalizedContent(value: LocalizedString | null | undefined): value is LocalizedString {
  return Boolean(value?.en?.trim() && value.zh?.trim());
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toEntryDto(
  entry: typeof catalogueEntries.$inferSelect,
  category: typeof projectCategories.$inferSelect,
  variants: Array<{
    association: typeof catalogueEntryProjects.$inferSelect;
    project: typeof diyProjects.$inferSelect;
  }>,
): AdminCatalogueEntryDto {
  return {
    id: entry.id,
    categoryId: entry.categoryId,
    name: entry.name,
    slug: entry.slug,
    description: entry.description,
    durationDisplay: entry.durationDisplay,
    occasionTags: entry.occasionTags,
    availabilityNote: entry.availabilityNote,
    published: entry.published,
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
      sortOrder: category.sortOrder,
    },
    variants: variants
      .sort((left, right) => left.association.sortOrder - right.association.sortOrder)
      .map(({ association, project }) => ({
        projectId: project.id,
        label: association.label ?? null,
        sortOrder: association.sortOrder,
        slug: project.slug,
        name: project.name,
        priceMin: project.priceMin,
        priceMax: project.priceMax,
        priceCurrency: project.priceCurrency ?? null,
        bookable: project.bookable,
      })),
  };
}

function mapRows(rows: CatalogueRow[]): AdminCatalogueEntryDto[] {
  const entries = new Map<
    string,
    {
      entry: CatalogueRow["catalogueEntry"];
      category: CatalogueRow["projectCategory"];
      variants: Array<{
        association: NonNullable<CatalogueRow["association"]>;
        project: NonNullable<CatalogueRow["project"]>;
      }>;
    }
  >();

  for (const row of rows) {
    const current = entries.get(row.catalogueEntry.id) ?? {
      entry: row.catalogueEntry,
      category: row.projectCategory,
      variants: [],
    };
    if (row.association && row.project) {
      current.variants.push({ association: row.association, project: row.project });
    }
    entries.set(row.catalogueEntry.id, current);
  }

  return [...entries.values()]
    .sort(
      (left, right) =>
        left.category.sortOrder - right.category.sortOrder ||
        left.entry.sortOrder - right.entry.sortOrder,
    )
    .map(({ entry, category, variants }) => toEntryDto(entry, category, variants));
}

export type AdminCatalogueService = ReturnType<typeof createAdminCatalogueService>;

export function createAdminCatalogueService(
  db: Db,
  redis: Redis | null = null,
  dependencies: AdminCatalogueDependencies = {},
) {
  const repository = dependencies.repository ?? createCatalogueRepository(db);
  const transaction: TransactionRunner =
    dependencies.transaction ??
    ((operation) =>
      db.transaction(async (database) =>
        operation(database as unknown as Db),
      ));

  function validateShape(input: CatalogueAdminInput) {
    if (!input.categoryId || !input.slug?.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "categoryId and slug are required");
    }
    if (!Array.isArray(input.occasionTags) || !Array.isArray(input.variants)) {
      throw new AppError(400, "VALIDATION_ERROR", "occasionTags and variants must be arrays");
    }
    if (!Number.isInteger(input.sortOrder)) {
      throw new AppError(400, "VALIDATION_ERROR", "sortOrder must be an integer");
    }
    if (!["yezyy", "inspiration", "placeholder"].includes(input.imageKind)) {
      throw new AppError(400, "VALIDATION_ERROR", "imageKind is invalid");
    }
    for (const [field, value] of [
      ["name", input.name],
      ["description", input.description],
      ["durationDisplay", input.durationDisplay],
      ["availabilityNote", input.availabilityNote],
    ] as const) {
      if (!hasLocalizedContent(value)) {
        throw new AppError(400, "VALIDATION_ERROR", `${field} requires en and zh`);
      }
    }
    if (input.occasionTags.some((tag) => !hasLocalizedContent(tag))) {
      throw new AppError(400, "VALIDATION_ERROR", "occasionTags require en and zh");
    }
    if (
      input.variants.some(
        (variant) =>
          !variant.projectId ||
          !Number.isInteger(variant.sortOrder) ||
          (variant.label !== null && !hasLocalizedContent(variant.label)),
      )
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Variants require a project ID, integer sort order, and bilingual label when supplied",
      );
    }
    if (input.imageKind === "inspiration") {
      if (
        !input.imageSourceUrl?.trim() ||
        !input.imageLicenseUrl?.trim() ||
        !isAbsoluteHttpUrl(input.imageSourceUrl) ||
        !isAbsoluteHttpUrl(input.imageLicenseUrl) ||
        !hasLocalizedContent(input.imageAttribution)
      ) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Inspiration images require source URL, license URL, and bilingual attribution",
        );
      }
    }
    if (new Set(input.variants.map((variant) => variant.projectId)).size !== input.variants.length) {
      throw new AppError(400, "VALIDATION_ERROR", "Linked project IDs must be unique");
    }
  }

  async function validateReferences(
    input: CatalogueAdminInput,
    database: Db,
    excludeId?: string,
  ) {
    const slug = input.slug.trim().toLowerCase();
    const [category, existingSlug, projects] = await Promise.all([
      repository.findCategoryById(input.categoryId, database),
      repository.findBySlug(slug, database),
      repository.findProjectsByIds(
        input.variants.map((variant) => variant.projectId),
        database,
      ),
    ]);
    if (!category) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid categoryId");
    }
    if (existingSlug && existingSlug.id !== excludeId) {
      throw new AppError(409, "CONFLICT", `Slug already exists: ${slug}`);
    }
    if (projects.length !== input.variants.length) {
      throw new AppError(400, "VALIDATION_ERROR", "Every linked project ID must exist");
    }
    if (
      input.published &&
      !projects.some((project) => project.priceMin != null || project.priceMax != null)
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Published catalogue entries require a linked operational project with a price",
      );
    }
    return { category, projects, slug };
  }

  async function mutate(
    input: unknown,
    operation: (database: Db, normalized: CatalogueEntryWriteInput) => Promise<typeof catalogueEntries.$inferSelect | null>,
    excludeId?: string,
  ) {
    const parsedInput = parseInput(input);
    validateShape(parsedInput);
    let result: AdminCatalogueEntryDto;
    try {
      result = await transaction(async (database) => {
        const { category, projects, slug } = await validateReferences(parsedInput, database, excludeId);
        const { variants: _variants, ...entryInput } = parsedInput;
        const normalized: CatalogueEntryWriteInput = { ...entryInput, slug };
        const entry = await operation(database, normalized);
        if (!entry) {
          throw new AppError(500, "INTERNAL_ERROR", "Failed to save catalogue entry");
        }
        await repository.replaceVariants(entry.id, parsedInput.variants, database);
        const projectById = new Map(projects.map((project) => [project.id, project]));
        return toEntryDto(
          entry,
          category,
          parsedInput.variants.map((variant) => ({
            association: { catalogueEntryId: entry.id, ...variant },
            project: projectById.get(variant.projectId)!,
          })),
        );
      });
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        throw new AppError(409, "CONFLICT", "Catalogue slug already exists");
      }
      throw error;
    }
    await invalidateCatalogueCache(redis);
    return result;
  }

  return {
    async list(): Promise<AdminCatalogueEntryDto[]> {
      return mapRows(await repository.findAllWithVariants());
    },

    async getById(id: string): Promise<AdminCatalogueEntryDto> {
      const [entry] = mapRows(await repository.findByIdWithVariants(asUuid(id, "id")));
      if (!entry) {
        throw new AppError(404, "NOT_FOUND", "Catalogue entry not found");
      }
      return entry;
    },

    create(input: unknown): Promise<AdminCatalogueEntryDto> {
      return mutate(input, (database, normalized) => repository.create(normalized, database));
    },

    async update(id: string, input: unknown): Promise<AdminCatalogueEntryDto> {
      const catalogueEntryId = asUuid(id, "id");
      const existing = await repository.findById(catalogueEntryId);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Catalogue entry not found");
      }
      return mutate(
        input,
        (database, normalized) => repository.update(catalogueEntryId, normalized, database),
        catalogueEntryId,
      );
    },
  };
}
