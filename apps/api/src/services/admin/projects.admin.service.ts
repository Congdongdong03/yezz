import type { Db } from "@yezz/db";
import type Redis from "ioredis";
import { AppError } from "../../lib/errors.js";
import { invalidateProjectsCache } from "../../lib/cache.js";
import { createCategoriesRepository } from "../../repositories/categories.repository.js";
import {
  createProjectsRepository,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from "../../repositories/projects.repository.js";
import { resolveProjectPricing } from "../../lib/pricing.js";
import type {
  ProjectDetailDto,
  ProjectListItemDto,
} from "../projects.service.js";
import { createProjectsService } from "../projects.service.js";

export type AdminProjectsListResult = {
  items: ProjectListItemDto[];
  total: number;
  page?: number;
  limit?: number;
};

export type AdminProjectsService = ReturnType<typeof createAdminProjectsService>;

export function createAdminProjectsService(db: Db, redis: Redis | null = null) {
  const projectsRepo = createProjectsRepository(db);
  const categoriesRepo = createCategoriesRepository(db);
  const publicProjects = createProjectsService(db, redis);

  async function assertCategory(categoryId: string) {
    const category = await categoriesRepo.findById(categoryId);
    if (!category) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid categoryId");
    }
    return category;
  }

  async function assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await projectsRepo.findBySlug(slug);
    if (existing && existing.id !== excludeId) {
      throw new AppError(409, "CONFLICT", `Slug already exists: ${slug}`);
    }
  }

  function validateCreateInput(input: ProjectCreateInput) {
    if (!input.categoryId || !input.slug?.trim() || !input.name?.en || !input.name?.zh) {
      throw new AppError(400, "VALIDATION_ERROR", "categoryId, slug, and name (en/zh) are required");
    }
    if (!["experience", "product"].includes(input.projectType)) {
      throw new AppError(400, "VALIDATION_ERROR", "projectType must be experience or product");
    }
  }

  function mapListRow({
    project,
    category,
  }: Awaited<ReturnType<typeof projectsRepo.findAllWithCategory>>[number]): ProjectListItemDto {
    const pricing = resolveProjectPricing(project);
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      projectType: project.projectType,
      description: project.description ?? null,
      priceRange: project.priceRange ?? null,
      ...pricing,
      duration: project.duration ?? null,
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

  return {
    async list(options?: { page?: number; limit?: number }): Promise<AdminProjectsListResult> {
      const page = options?.page;
      const limit = options?.limit;

      if (page !== undefined || limit !== undefined) {
        const resolvedPage = Math.max(1, page ?? 1);
        const resolvedLimit = Math.min(100, Math.max(1, limit ?? 20));
        const total = await projectsRepo.countAll();
        const rows = await projectsRepo.findAllWithCategoryPaginated(
          resolvedLimit,
          (resolvedPage - 1) * resolvedLimit,
        );
        return {
          items: rows.map(mapListRow),
          total,
          page: resolvedPage,
          limit: resolvedLimit,
        };
      }

      const rows = await projectsRepo.findAllWithCategory();
      return {
        items: rows.map(mapListRow),
        total: rows.length,
      };
    },

    async getById(id: string): Promise<ProjectDetailDto> {
      const project = await projectsRepo.findById(id);
      if (!project) {
        throw new AppError(404, "NOT_FOUND", "Project not found");
      }
      return publicProjects.getBySlug(project.slug);
    },

    async create(input: ProjectCreateInput): Promise<ProjectDetailDto> {
      validateCreateInput(input);
      await assertCategory(input.categoryId);
      await assertSlugAvailable(input.slug.trim());

      const project = await projectsRepo.create({
        ...input,
        slug: input.slug.trim(),
      });
      if (!project) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to create project");
      }

      await invalidateProjectsCache(redis);
      return publicProjects.getBySlug(project.slug);
    },

    async update(id: string, input: ProjectUpdateInput): Promise<ProjectDetailDto> {
      const existing = await projectsRepo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Project not found");
      }

      if (input.categoryId) {
        await assertCategory(input.categoryId);
      }
      if (input.slug) {
        await assertSlugAvailable(input.slug.trim(), id);
        input.slug = input.slug.trim();
      }
      if (input.name && (!input.name.en?.trim() || !input.name.zh?.trim())) {
        throw new AppError(400, "VALIDATION_ERROR", "name requires en and zh");
      }

      const updated = await projectsRepo.update(id, input);
      if (!updated) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to update project");
      }

      await invalidateProjectsCache(redis);
      return publicProjects.getBySlug(updated.slug);
    },

    async delete(id: string): Promise<{ id: string }> {
      const deleted = await projectsRepo.delete(id);
      if (!deleted) {
        throw new AppError(404, "NOT_FOUND", "Project not found");
      }
      await invalidateProjectsCache(redis);
      return { id: deleted.id };
    },
  };
}
