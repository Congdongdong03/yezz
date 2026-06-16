import { diyProjects, projectCategories, type Db, type LocalizedString } from "@yezz/db";
import { asc, count, eq } from "drizzle-orm";

export type CategoryCreateInput = {
  name: LocalizedString;
  slug: string;
  description?: LocalizedString | null;
  icon?: string | null;
  sortOrder?: number;
};

export type CategoryUpdateInput = {
  name?: LocalizedString;
  description?: LocalizedString | null;
  icon?: string | null;
  sortOrder?: number;
};

export function createCategoriesRepository(db: Db) {
  return {
    findAllOrdered() {
      return db
        .select()
        .from(projectCategories)
        .orderBy(asc(projectCategories.sortOrder));
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(projectCategories)
        .where(eq(projectCategories.id, id))
        .limit(1);
      return row ?? null;
    },

    async findBySlug(slug: string) {
      const [row] = await db
        .select()
        .from(projectCategories)
        .where(eq(projectCategories.slug, slug))
        .limit(1);
      return row ?? null;
    },

    async create(data: CategoryCreateInput) {
      const [row] = await db
        .insert(projectCategories)
        .values({
          name: data.name,
          slug: data.slug.trim().toLowerCase(),
          description: data.description ?? null,
          icon: data.icon?.trim() || null,
          sortOrder: data.sortOrder ?? 0,
          updatedAt: new Date(),
        })
        .returning();
      return row;
    },

    async update(id: string, data: CategoryUpdateInput) {
      const [row] = await db
        .update(projectCategories)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(projectCategories.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id: string) {
      const [row] = await db
        .delete(projectCategories)
        .where(eq(projectCategories.id, id))
        .returning();
      return row ?? null;
    },

    async countProjectsByCategoryId(categoryId: string) {
      const [row] = await db
        .select({ value: count() })
        .from(diyProjects)
        .where(eq(diyProjects.categoryId, categoryId));
      return Number(row?.value ?? 0);
    },
  };
}
