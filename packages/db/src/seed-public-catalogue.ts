import { asc, eq, inArray } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createDb, type Db } from "./client.js";
import {
  PUBLIC_CATALOGUE_AVAILABILITY_NOTE,
  PUBLIC_CATALOGUE_ENTRIES,
} from "./catalogue-data.js";
import { loadEnv } from "./env.js";
import {
  LIVE_DIY_PROJECTS,
  LIVE_PROJECT_CATEGORIES,
} from "./live-booking-catalogue.js";
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

    for (const category of LIVE_PROJECT_CATEGORIES) {
      await database
        .update(projectCategories)
        .set({ sortOrder: category.sortOrder })
        .where(eq(projectCategories.slug, category.slug));
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

    for (const project of LIVE_DIY_PROJECTS) {
      if (
        project.slug === "air-dry-phone-case" ||
        project.slug === "air-dry-lamp"
      ) {
        await database
          .update(diyProjects)
          .set({
            priceMin: project.priceMinCents,
            priceMax: project.priceMaxCents,
          })
          .where(eq(diyProjects.slug, project.slug));
      }
    }

    for (const entry of PUBLIC_CATALOGUE_ENTRIES) {
      const categoryId = categoryIdBySlug.get(entry.categorySlug);
      if (!categoryId)
        throw new Error(
          `Missing category for public catalogue entry: ${entry.slug}`,
        );

      const [existingEntry] = await database
        .select({ coverImageUrl: catalogueEntries.coverImageUrl })
        .from(catalogueEntries)
        .where(eq(catalogueEntries.slug, entry.slug));
      const replaceImageBundle = !existingEntry?.coverImageUrl;

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
            ...(replaceImageBundle
              ? {
                  coverImageUrl: entry.image.coverImageUrl,
                  imageKind: entry.image.imageKind,
                  imageSourceUrl: entry.image.sourceUrl,
                  imageLicenseUrl: entry.image.licenseUrl,
                  imageAttribution: {
                    en: entry.image.attribution,
                    zh: entry.image.attribution,
                  },
                }
              : {}),
            updatedAt: new Date(),
          },
        })
        .returning({ id: catalogueEntries.id });
      if (!catalogueEntry)
        throw new Error(
          `Unable to upsert public catalogue entry: ${entry.slug}`,
        );

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
      .where(eq(projectStyles.projectId, beadingProjectId))
      .orderBy(asc(projectStyles.sortOrder), asc(projectStyles.id));
    for (const [sortOrder, style] of beadingStyles.entries()) {
      const existingStyle = existingBeadingStyles[sortOrder];
      if (existingStyle) {
        await database
          .update(projectStyles)
          .set({ name: style.name, price: style.price, sortOrder })
          .where(eq(projectStyles.id, existingStyle.id));
      } else {
        await database.insert(projectStyles).values({
          projectId: beadingProjectId,
          name: style.name,
          imageUrl: null,
          price: style.price,
          sortOrder,
        });
      }
    }
    const obsoleteStyles = existingBeadingStyles.slice(beadingStyles.length);
    for (const style of obsoleteStyles) {
      await database.delete(projectStyles).where(eq(projectStyles.id, style.id));
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
