import type { Db, LocalizedString } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import {
  createCategoriesRepository,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from "../../repositories/categories.repository.js";
import type { CategoryDto } from "../categories.service.js";

function toCategoryDto(
  row: Awaited<ReturnType<ReturnType<typeof createCategoriesRepository>["findAllOrdered"]>>[number],
): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    icon: row.icon ?? null,
    sortOrder: row.sortOrder,
  };
}

export type AdminCategoriesService = ReturnType<typeof createAdminCategoriesService>;

export function createAdminCategoriesService(db: Db) {
  const repo = createCategoriesRepository(db);

  return {
    async list(): Promise<CategoryDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(toCategoryDto);
    },

    async create(input: CategoryCreateInput): Promise<CategoryDto> {
      if (!input.name?.en?.trim() || !input.name?.zh?.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "Category name requires en and zh");
      }
      if (!input.slug?.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "slug is required");
      }

      const existing = await repo.findBySlug(input.slug.trim().toLowerCase());
      if (existing) {
        throw new AppError(409, "CONFLICT", "Category slug already exists");
      }

      const row = await repo.create(input);
      return toCategoryDto(row);
    },

    async update(id: string, input: CategoryUpdateInput): Promise<CategoryDto> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Category not found");
      }

      if (input.name && (!input.name.en?.trim() || !input.name.zh?.trim())) {
        throw new AppError(400, "VALIDATION_ERROR", "Category name requires en and zh");
      }

      const updated = await repo.update(id, input);
      if (!updated) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to update category");
      }

      return toCategoryDto(updated);
    },

    async remove(id: string): Promise<{ id: string }> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Category not found");
      }

      const projectCount = await repo.countProjectsByCategoryId(id);
      if (projectCount > 0) {
        throw new AppError(409, "CONFLICT", `Cannot delete category with ${projectCount} associated project(s)`);
      }

      await repo.delete(id);
      return { id };
    },
  };
}
