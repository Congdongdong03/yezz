import type { Db } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import {
  createCategoriesRepository,
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
  };
}
