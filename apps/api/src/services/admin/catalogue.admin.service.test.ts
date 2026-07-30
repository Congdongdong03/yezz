import type { diyProjects, LocalizedString } from "@yezz/db";
import { describe, expect, it } from "vitest";
import {
  createAdminCatalogueService,
  type CatalogueAdminInput,
} from "./catalogue.admin.service.js";

const category = {
  id: "00000000-0000-4000-8000-000000000001",
  name: { en: "Paint clay", zh: "彩绘黏土" },
  slug: "paint-clay",
  icon: null,
  sortOrder: 0,
};

type OperationalProject = typeof diyProjects.$inferSelect;

const operationalProject: OperationalProject = {
  id: "00000000-0000-4000-8000-000000000002",
  categoryId: category.id,
  name: { en: "Plaster Painting", zh: "石膏彩绘" },
  slug: "plaster-painting",
  projectType: "experience" as const,
  description: null,
  priceRange: null,
  priceMin: 1980,
  priceMax: 5400,
  priceCurrency: "AUD",
  duration: null,
  durationMinutes: null,
  bookable: false,
  variantSelectedInStore: false,
  extraTimeMinutes: null,
  extraTimePriceCents: null,
  tags: null,
  sortOrder: 0,
  coverImageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function input(overrides: Partial<CatalogueAdminInput> = {}): CatalogueAdminInput {
  return {
    categoryId: category.id,
    name: { en: "Plaster Painting", zh: "石膏彩绘" },
    slug: "plaster-painting",
    description: { en: "Paint a figurine.", zh: "彩绘摆件。" },
    durationDisplay: { en: "About 1 hour", zh: "约 1 小时" },
    occasionTags: [{ en: "Family activity", zh: "亲子活动" }],
    availabilityNote: { en: "Styles vary.", zh: "款式以店内为准。" },
    published: false,
    featured: false,
    sortOrder: 0,
    coverImageUrl: null,
    imageKind: "yezyy",
    imageSourceUrl: null,
    imageLicenseUrl: null,
    imageAttribution: null,
    variants: [
      {
        projectId: operationalProject.id,
        label: null,
        sortOrder: 0,
      },
    ],
    ...overrides,
  };
}

function createService(options: {
  existingSlug?: string | null;
  projects?: OperationalProject[];
  createError?: unknown;
} = {}) {
  const projects = options.projects ?? [operationalProject];
  let transactionCount = 0;
  const cachedKeys = new Set(["catalogue:list", "catalogue:slug:plaster-painting"]);
  let stored = {
    id: "00000000-0000-4000-8000-000000000003",
    ...input(),
  };

  const repository = {
    findAllWithVariants: async () => [],
    findByIdWithVariants: async () => [],
    findById: async (id: string) => (id === stored.id ? stored : null),
    findBySlug: async (slug: string) =>
      options.existingSlug === slug ? { id: "catalogue-existing", slug } : null,
    findCategoryById: async (id: string) => (id === category.id ? category : null),
    findProjectsByIds: async (ids: string[]) =>
      projects.filter((project) => ids.includes(project.id)),
    create: async (value: CatalogueAdminInput) => {
      if (options.createError) throw options.createError;
      stored = { id: "catalogue-1", ...value };
      return stored;
    },
    update: async (id: string, value: CatalogueAdminInput) => {
      if (id !== stored.id) return null;
      stored = { id, ...value };
      return stored;
    },
    replaceVariants: async () => undefined,
  };

  return {
    service: createAdminCatalogueService(null as never, {
      keys: async () => [...cachedKeys],
      del: async (...keys: string[]) => {
        keys.forEach((key) => cachedKeys.delete(key));
      },
    } as never, {
      repository: repository as never,
      transaction: async (operation) => {
        transactionCount += 1;
        return operation(null as never);
      },
    }),
    getTransactionCount: () => transactionCount,
    getCachedKeys: () => [...cachedKeys],
    getProject: () => projects[0],
  };
}

describe("admin catalogue validation", () => {
  it("requires English and Chinese names, descriptions, and durations", async () => {
    for (const field of ["name", "description", "durationDisplay"] as const) {
      const service = createService().service;
      const localized = { ...input()[field], zh: "" } as LocalizedString;

      await expect(service.create(input({ [field]: localized }))).rejects.toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }
  });

  it("rejects a conflicting catalogue slug", async () => {
    const { service } = createService({ existingSlug: "plaster-painting" });

    await expect(service.create(input())).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("maps a concurrent unique slug violation to a conflict", async () => {
    const { service } = createService({ createError: { code: "23505" } });

    await expect(service.create(input())).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("returns a validation error for a malformed request body", async () => {
    const { service } = createService();

    await expect(service.create(null as never)).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects every missing linked operational project", async () => {
    const { service } = createService();

    await expect(
      service.create(input({ variants: [{ projectId: "missing", label: null, sortOrder: 0 }] })),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("requires provenance for an inspiration image", async () => {
    const { service } = createService();

    await expect(
      service.create(input({ imageKind: "inspiration" })),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("requires absolute HTTP(S) URLs for inspiration provenance", async () => {
    const { service } = createService();
    const inspiration = input({
      imageKind: "inspiration",
      imageSourceUrl: "not-a-url",
      imageLicenseUrl: "https://license.example/terms",
      imageAttribution: { en: "Example source", zh: "示例来源" },
    });

    await expect(service.create(inspiration)).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });

    await expect(
      service.create({ ...inspiration, imageSourceUrl: "https://source.example/image", imageLicenseUrl: "not-a-url" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });

    await expect(
      service.create({
        ...inspiration,
        imageSourceUrl: "https://source.example/image",
      }),
    ).resolves.toMatchObject({ image: { kind: "inspiration" } });
  });

  it("allows a YezYY image without external provenance", async () => {
    const { service, getTransactionCount, getCachedKeys } = createService();

    await expect(service.create(input())).resolves.toMatchObject({
      id: "catalogue-1",
      image: { kind: "yezyy", sourceUrl: null, licenseUrl: null, attribution: null },
    });
    expect(getTransactionCount()).toBe(1);
    expect(getCachedKeys()).toEqual([]);
  });

  it("requires a linked operational price before publication", async () => {
    const unpricedProject = { ...operationalProject, priceMin: null, priceMax: null };
    const { service } = createService({ projects: [unpricedProject] });

    await expect(service.create(input({ published: true }))).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("does not change operational IDs or bookability when publishing", async () => {
    const { service, getProject } = createService();

    const result = await service.update(
      "00000000-0000-4000-8000-000000000003",
      input({ published: true }),
    );

    expect(result.variants).toEqual([
      expect.objectContaining({ projectId: operationalProject.id, bookable: false }),
    ]);
    expect(getProject()).toMatchObject({ id: operationalProject.id, bookable: false });
  });

  it("keeps a zero-variant draft visible to admin list and detail reads", async () => {
    const draft = {
      id: "00000000-0000-4000-8000-000000000003",
      ...input({ variants: [] }),
    };
    const row = {
      catalogueEntry: draft,
      projectCategory: category,
      association: null,
      project: null,
    };
    const service = createAdminCatalogueService(null as never, null, {
      repository: {
        findAllWithVariants: async () => [row],
        findByIdWithVariants: async () => [row],
      } as never,
    });

    await expect(service.list()).resolves.toMatchObject([
      { id: draft.id, published: false, variants: [] },
    ]);
    await expect(service.getById(draft.id)).resolves.toMatchObject({
      id: draft.id,
      published: false,
      variants: [],
    });
  });
});
