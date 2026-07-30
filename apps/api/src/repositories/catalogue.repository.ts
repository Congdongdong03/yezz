import {
  catalogueEntries,
  catalogueEntryProjects,
  diyProjects,
  projectCategories,
  type CatalogueImageKind,
  type Db,
  type LocalizedString,
} from "@yezz/db";
import { and, asc, eq, inArray } from "drizzle-orm";

export type CatalogueEntryWriteInput = {
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
  imageKind: CatalogueImageKind;
  imageSourceUrl: string | null;
  imageLicenseUrl: string | null;
  imageAttribution: LocalizedString | null;
};

export type CatalogueVariantWriteInput = {
  projectId: string;
  label: LocalizedString | null;
  sortOrder: number;
};

export function createCatalogueRepository(db: Db) {
  const selectWithVariants = (database: Db = db) =>
    database
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
      return selectWithVariants()
        .where(eq(catalogueEntries.published, true))
        .orderBy(
          asc(projectCategories.sortOrder),
          asc(catalogueEntries.sortOrder),
          asc(catalogueEntryProjects.sortOrder),
        );
    },

    findPublishedBySlugWithVariants(slug: string) {
      return selectWithVariants()
        .where(
          and(
            eq(catalogueEntries.published, true),
            eq(catalogueEntries.slug, slug),
          ),
        )
        .orderBy(asc(catalogueEntryProjects.sortOrder));
    },

    findAllWithVariants() {
      return selectWithVariants().orderBy(
        asc(projectCategories.sortOrder),
        asc(catalogueEntries.sortOrder),
        asc(catalogueEntryProjects.sortOrder),
      );
    },

    findByIdWithVariants(id: string) {
      return selectWithVariants()
        .where(eq(catalogueEntries.id, id))
        .orderBy(asc(catalogueEntryProjects.sortOrder));
    },

    async findById(id: string, database: Db = db) {
      const [entry] = await database
        .select()
        .from(catalogueEntries)
        .where(eq(catalogueEntries.id, id))
        .limit(1);
      return entry ?? null;
    },

    async findBySlug(slug: string, database: Db = db) {
      const [entry] = await database
        .select()
        .from(catalogueEntries)
        .where(eq(catalogueEntries.slug, slug))
        .limit(1);
      return entry ?? null;
    },

    async findCategoryById(id: string, database: Db = db) {
      const [category] = await database
        .select()
        .from(projectCategories)
        .where(eq(projectCategories.id, id))
        .limit(1);
      return category ?? null;
    },

    findProjectsByIds(ids: string[], database: Db = db) {
      if (ids.length === 0) return Promise.resolve([]);
      return database
        .select()
        .from(diyProjects)
        .where(inArray(diyProjects.id, ids));
    },

    async create(input: CatalogueEntryWriteInput, database: Db = db) {
      const [entry] = await database
        .insert(catalogueEntries)
        .values(input)
        .returning();
      return entry ?? null;
    },

    async update(
      id: string,
      input: CatalogueEntryWriteInput,
      database: Db = db,
    ) {
      const [entry] = await database
        .update(catalogueEntries)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(catalogueEntries.id, id))
        .returning();
      return entry ?? null;
    },

    async replaceVariants(
      catalogueEntryId: string,
      variants: CatalogueVariantWriteInput[],
      database: Db = db,
    ) {
      await database
        .delete(catalogueEntryProjects)
        .where(eq(catalogueEntryProjects.catalogueEntryId, catalogueEntryId));
      if (variants.length > 0) {
        await database.insert(catalogueEntryProjects).values(
          variants.map((variant) => ({
            catalogueEntryId,
            ...variant,
          })),
        );
      }
    },
  };
}

export type CatalogueRepository = ReturnType<typeof createCatalogueRepository>;
