import type { diyProjects, projectCategories } from "@yezz/db";
import type { Db } from "@yezz/db";
import type Redis from "ioredis";
import { AppError } from "../lib/errors.js";
import { CACHE_KEYS, cacheGet, cacheSet } from "../lib/cache.js";
import { formatStylePrice, resolveProjectPricing } from "../lib/pricing.js";
import { createCategoriesRepository } from "../repositories/categories.repository.js";
import { createProjectsRepository } from "../repositories/projects.repository.js";

export type CategorySummaryDto = {
  id: string;
  name: { en: string; zh: string };
  slug: string;
  icon: string | null;
};

export type ProjectListItemDto = {
  id: string;
  name: { en: string; zh: string };
  slug: string;
  projectType: "experience" | "product";
  description: { en: string; zh: string } | null;
  priceRange: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: "AUD";
  priceDisplay: string | null;
  duration: string | null;
  durationMinutes: number | null;
  bookable: boolean;
  variantSelectedInStore: boolean;
  extraTimeMinutes: number | null;
  extraTimePriceCents: number | null;
  tags: string[] | null;
  sortOrder: number;
  coverImageUrl: string | null;
  category: CategorySummaryDto;
};

export type ProjectStyleDto = {
  id: string;
  name: { en: string; zh: string };
  imageUrl: string | null;
  price: string | null;
  priceDisplay: string | null;
  sortOrder: number;
};

export type ProjectImageDto = {
  id: string;
  url: string;
  sortOrder: number;
};

export type ProjectDetailDto = ProjectListItemDto & {
  styles: ProjectStyleDto[];
  images: ProjectImageDto[];
};

export type ProjectsService = ReturnType<typeof createProjectsService>;

type ProjectRow = typeof diyProjects.$inferSelect;
type CategoryRow = typeof projectCategories.$inferSelect;

export function mapProjectRow(
  project: ProjectRow,
  category: CategoryRow,
): ProjectListItemDto {
  const pricing = resolveProjectPricing(project);
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    projectType: project.projectType,
    description: project.description ?? null,
    priceRange: project.priceRange ?? null,
    ...pricing,
    priceCurrency: "AUD",
    duration: project.duration ?? null,
    durationMinutes: project.durationMinutes ?? null,
    bookable: project.bookable,
    variantSelectedInStore: project.variantSelectedInStore,
    extraTimeMinutes: project.extraTimeMinutes ?? null,
    extraTimePriceCents: project.extraTimePriceCents ?? null,
    tags: project.tags ?? null,
    sortOrder: project.sortOrder,
    coverImageUrl: project.coverImageUrl ?? null,
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon ?? null,
    },
  };
}

export function createProjectsService(db: Db, redis: Redis | null = null) {
  const projectsRepo = createProjectsRepository(db);
  const categoriesRepo = createCategoriesRepository(db);

  return {
    async list(): Promise<ProjectListItemDto[]> {
      const cached = await cacheGet<ProjectListItemDto[]>(redis, CACHE_KEYS.projectsList);
      if (cached) return cached;

      const rows = await projectsRepo.findAllWithCategory();
      const result = rows.map(({ project, category }) => mapProjectRow(project, category));
      await cacheSet(redis, CACHE_KEYS.projectsList, result);
      return result;
    },

    async getBySlug(slug: string): Promise<ProjectDetailDto> {
      const cacheKey = CACHE_KEYS.projectSlug(slug);
      const cached = await cacheGet<ProjectDetailDto>(redis, cacheKey);
      if (cached) return cached;

      const project = await projectsRepo.findBySlug(slug);
      if (!project) {
        throw new AppError(404, "NOT_FOUND", `Project not found: ${slug}`);
      }

      const category = await categoriesRepo.findById(project.categoryId);
      if (!category) {
        throw new AppError(500, "INTERNAL_ERROR", "Project category missing");
      }

      const [styles, images] = await Promise.all([
        projectsRepo.findStylesByProjectId(project.id),
        projectsRepo.findImagesByProjectId(project.id),
      ]);

      const summary = mapProjectRow(project, category);
      const currency = summary.priceCurrency;

      const result: ProjectDetailDto = {
        ...summary,
        styles: styles.map((s) => ({
          id: s.id,
          name: s.name,
          imageUrl: s.imageUrl ?? null,
          price: s.price ?? null,
          priceDisplay: formatStylePrice(s.price, currency),
          sortOrder: s.sortOrder,
        })),
        images: images.map((img) => ({
          id: img.id,
          url: img.url,
          sortOrder: img.sortOrder,
        })),
      };
      await cacheSet(redis, cacheKey, result);
      return result;
    },
  };
}
