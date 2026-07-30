import {
  catalogueEntries,
  catalogueEntryProjects,
  diyProjects,
  projectCategories,
  type Db,
} from "@yezz/db";
import { and, asc, eq } from "drizzle-orm";

export function createCatalogueRepository(db: Db) {
  const selectPublishedWithVariants = () =>
    db
      .select({
        catalogueEntry: catalogueEntries,
        projectCategory: projectCategories,
        association: catalogueEntryProjects,
        project: diyProjects,
      })
      .from(catalogueEntries)
      .innerJoin(
        projectCategories,
        eq(catalogueEntries.categoryId, projectCategories.id),
      )
      .leftJoin(
        catalogueEntryProjects,
        eq(catalogueEntries.id, catalogueEntryProjects.catalogueEntryId),
      )
      .leftJoin(
        diyProjects,
        eq(catalogueEntryProjects.projectId, diyProjects.id),
      );

  return {
    findPublishedWithVariants() {
      return selectPublishedWithVariants()
        .where(eq(catalogueEntries.published, true))
        .orderBy(
          asc(projectCategories.sortOrder),
          asc(catalogueEntries.sortOrder),
          asc(catalogueEntryProjects.sortOrder),
        );
    },

    findPublishedBySlugWithVariants(slug: string) {
      return selectPublishedWithVariants()
        .where(
          and(
            eq(catalogueEntries.published, true),
            eq(catalogueEntries.slug, slug),
          ),
        )
        .orderBy(asc(catalogueEntryProjects.sortOrder));
    },
  };
}
