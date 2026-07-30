import { eq, inArray } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createDb, type Db } from "./client.js";
import {
  PUBLIC_CATALOGUE_AVAILABILITY_NOTE,
  PUBLIC_CATALOGUE_ENTRIES,
} from "./catalogue-data.js";
import { loadEnv } from "./env.js";
import { LIVE_DIY_PROJECTS } from "./live-booking-catalogue.js";
import {
  catalogueEntries,
  catalogueEntryProjects,
  diyProjects,
  projectCategories,
  projectStyles,
} from "./schema/index.js";

const beadingProject = LIVE_DIY_PROJECTS.find(
  (project) => project.slug === "beading",
);

if (!beadingProject?.styles) {
  throw new Error(
    "The approved Beading style list is required for the public catalogue seed.",
  );
}

const beadingStyles = beadingProject.styles;

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export async function seedPublicCatalogue(db: Db): Promise<void> {
  const categorySlugs = unique(
    PUBLIC_CATALOGUE_ENTRIES.map((entry) => entry.categorySlug),
  );
  const projectSlugs = unique(
    PUBLIC_CATALOGUE_ENTRIES.flatMap((entry) => entry.projectSlugs),
  );

  await db.transaction(async (transaction) => {
    const database = transaction as unknown as Db;
    const categories = await database
      .select({ id: projectCategories.id, slug: projectCategories.slug })
      .from(projectCategories)
      .where(inArray(projectCategories.slug, categorySlugs));
    const categoryIdBySlug = new Map(
      categories.map((category) => [category.slug, category.id]),
    );

    for (const categorySlug of categorySlugs) {
      if (!categoryIdBySlug.has(categorySlug)) {
        throw new Error(
          `Missing category for public catalogue entry: ${categorySlug}`,
        );
      }
    }

    const projects = await database
      .select({ id: diyProjects.id, slug: diyProjects.slug })
      .from(diyProjects)
      .where(inArray(diyProjects.slug, projectSlugs));
    const projectIdBySlug = new Map(
      projects.map((project) => [project.slug, project.id]),
    );

    for (const projectSlug of projectSlugs) {
      if (!projectIdBySlug.has(projectSlug)) {
        throw new Error(
          `Missing operational project for public catalogue entry: ${projectSlug}`,
        );
      }
    }

    for (const entry of PUBLIC_CATALOGUE_ENTRIES) {
      const categoryId = categoryIdBySlug.get(entry.categorySlug);
      if (!categoryId)
        throw new Error(
          `Missing category for public catalogue entry: ${entry.slug}`,
        );

      const [catalogueEntry] = await database
        .insert(catalogueEntries)
        .values({
          categoryId,
          name: entry.name,
          slug: entry.slug,
          description: entry.description,
          durationDisplay: entry.durationDisplay,
          occasionTags: entry.occasionTags,
          availabilityNote: PUBLIC_CATALOGUE_AVAILABILITY_NOTE,
          published: entry.published,
          featured: entry.featured,
          sortOrder: entry.sortOrder,
          coverImageUrl: entry.image.coverImageUrl,
          imageKind: entry.image.imageKind,
          imageSourceUrl: entry.image.sourceUrl,
          imageLicenseUrl: entry.image.licenseUrl,
          imageAttribution: {
            en: entry.image.attribution,
            zh: entry.image.attribution,
          },
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: catalogueEntries.slug,
          set: {
            categoryId,
            name: entry.name,
            description: entry.description,
            durationDisplay: entry.durationDisplay,
            occasionTags: entry.occasionTags,
            availabilityNote: PUBLIC_CATALOGUE_AVAILABILITY_NOTE,
            featured: entry.featured,
            sortOrder: entry.sortOrder,
            imageKind: entry.image.imageKind,
            imageSourceUrl: entry.image.sourceUrl,
            imageLicenseUrl: entry.image.licenseUrl,
            imageAttribution: {
              en: entry.image.attribution,
              zh: entry.image.attribution,
            },
            updatedAt: new Date(),
          },
        })
        .returning({ id: catalogueEntries.id });
      if (!catalogueEntry)
        throw new Error(
          `Unable to upsert public catalogue entry: ${entry.slug}`,
        );

      const [existingImage] = await database
        .select({ coverImageUrl: catalogueEntries.coverImageUrl })
        .from(catalogueEntries)
        .where(eq(catalogueEntries.id, catalogueEntry.id));
      if (!existingImage?.coverImageUrl) {
        await database
          .update(catalogueEntries)
          .set({
            coverImageUrl: entry.image.coverImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(catalogueEntries.id, catalogueEntry.id));
      }

      await database
        .delete(catalogueEntryProjects)
        .where(eq(catalogueEntryProjects.catalogueEntryId, catalogueEntry.id));
      await database.insert(catalogueEntryProjects).values(
        entry.projectSlugs.map((projectSlug, sortOrder) => ({
          catalogueEntryId: catalogueEntry.id,
          projectId: projectIdBySlug.get(projectSlug)!,
          label: null,
          sortOrder,
        })),
      );
    }

    const beadingProjectId = projectIdBySlug.get("beading");
    if (!beadingProjectId)
      throw new Error("Missing operational project for Beading styles");
    const existingBeadingStyles = await database
      .select({ id: projectStyles.id })
      .from(projectStyles)
      .where(eq(projectStyles.projectId, beadingProjectId));
    if (existingBeadingStyles.length === 0) {
      await database.insert(projectStyles).values(
        beadingStyles.map((style, sortOrder) => ({
          projectId: beadingProjectId,
          name: style.name,
          imageUrl: null,
          price: style.price,
          sortOrder,
        })),
      );
    }
  });
}

export async function runPublicCatalogueSeed(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  loadEnv({ env });
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const { db, client } = createDb(databaseUrl);
  try {
    await seedPublicCatalogue(db);
    console.log("Public YezYY catalogue seeded");
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  runPublicCatalogueSeed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
