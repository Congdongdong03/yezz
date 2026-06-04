import { projectCategories, type Db, type LocalizedString } from "@yezz/db";
import { asc, eq } from "drizzle-orm";

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
  };
}
