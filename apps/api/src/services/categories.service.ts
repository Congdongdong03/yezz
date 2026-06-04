import type { Db } from "@yezz/db";
import { createCategoriesRepository } from "../repositories/categories.repository.js";

export type CategoryDto = {
  id: string;
  name: { en: string; zh: string };
  slug: string;
  description: { en: string; zh: string } | null;
  icon: string | null;
  sortOrder: number;
};

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

export type CategoriesService = ReturnType<typeof createCategoriesService>;

export function createCategoriesService(db: Db) {
  const repo = createCategoriesRepository(db);

  return {
    async list(): Promise<CategoryDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(toCategoryDto);
    },
  };
}
