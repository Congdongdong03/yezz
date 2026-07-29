import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createDb, type Db } from "./client.js";
import {
  LIVE_DIY_PROJECTS,
  LIVE_PARTY_PACKAGES,
  LIVE_PROJECT_CATEGORIES,
  type LiveProjectSeed as LiveProjectCatalogueSeed,
} from "./live-booking-catalogue.js";
import { loadEnv } from "./env.js";
import { diyProjects, partyPackages, projectCategories } from "./schema/index.js";

type LiveCategorySeed = (typeof LIVE_PROJECT_CATEGORIES)[number];
type LivePartySeed = (typeof LIVE_PARTY_PACKAGES)[number];

export type LiveCatalogueSeedStore = {
  upsertCategory(category: LiveCategorySeed): Promise<{ id: string }>;
  upsertProject(project: LiveProjectCatalogueSeed & { categoryId: string; sortOrder: number }): Promise<void>;
  upsertParty(party: LivePartySeed & { sortOrder: number }): Promise<void>;
};

export type LiveBookingCatalogueSeedRunOptions = {
  loadEnvironment?: () => unknown;
};

export function assertLiveCatalogueSeedConfirmation(
  env: Record<string, string | undefined>,
): void {
  if (env.CONFIRM_LIVE_CATALOGUE_SEED !== "YezYY") {
    throw new Error(
      "Refusing to seed the live catalogue. Set CONFIRM_LIVE_CATALOGUE_SEED=YezYY exactly.",
    );
  }
}

export async function seedLiveBookingCatalogue(
  store: LiveCatalogueSeedStore,
): Promise<void> {
  const categoryIdBySlug = new Map<string, string>();
  for (const category of LIVE_PROJECT_CATEGORIES) {
    const { id } = await store.upsertCategory(category);
    categoryIdBySlug.set(category.slug, id);
  }

  for (const [sortOrder, project] of LIVE_DIY_PROJECTS.entries()) {
    const categoryId = categoryIdBySlug.get(project.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing category for live project ${project.slug}`);
    }
    await store.upsertProject({ ...project, categoryId, sortOrder });
  }

  for (const [sortOrder, party] of LIVE_PARTY_PACKAGES.entries()) {
    await store.upsertParty({ ...party, sortOrder });
  }
}

function formatAudCents(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

export function createLiveCatalogueSeedStore(db: Db): LiveCatalogueSeedStore {
  return {
    async upsertCategory(category) {
      const updatedAt = new Date();
      const [row] = await db
        .insert(projectCategories)
        .values({
          name: category.name,
          slug: category.slug,
          description: null,
          icon: null,
          sortOrder: category.sortOrder,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: projectCategories.slug,
          set: {
            name: category.name,
            description: null,
            icon: null,
            sortOrder: category.sortOrder,
            updatedAt,
          },
        })
        .returning({ id: projectCategories.id });
      if (!row) throw new Error(`Unable to upsert category ${category.slug}`);
      return row;
    },

    async upsertProject(project) {
      const updatedAt = new Date();
      const values = {
        categoryId: project.categoryId,
        name: project.name,
        slug: project.slug,
        projectType: "experience" as const,
        description: null,
        priceRange: formatAudCents(project.priceMinCents),
        priceMin: project.priceMinCents,
        priceMax: project.priceMaxCents,
        priceCurrency: "AUD",
        duration: `${project.durationMinutes} minutes`,
        durationMinutes: project.durationMinutes,
        bookable: false,
        variantSelectedInStore: project.variantSelectedInStore,
        extraTimeMinutes: project.extraTimeMinutes ?? null,
        extraTimePriceCents: project.extraTimePriceCents ?? null,
        tags: [],
        sortOrder: project.sortOrder,
        coverImageUrl: null,
        updatedAt,
      };
      await db
        .insert(diyProjects)
        .values(values)
        .onConflictDoUpdate({
          target: diyProjects.slug,
          set: values,
        });
    },

    async upsertParty(party) {
      const updatedAt = new Date();
      const values = {
        name: party.name,
        slug: party.slug,
        description: null,
        includes: [],
        coverImageUrl: null,
        imageUrls: [],
        minPeople: party.minPeople,
        maxPeople: party.maxPeople,
        priceIndicator: null,
        guestDurationMinutes: party.guestDurationMinutes,
        setupMinutes: party.setupMinutes,
        cleanupMinutes: party.cleanupMinutes,
        venueFeeCents: party.venueFeeCents,
        minSpendPerPersonCents: party.minSpendPerPersonCents,
        minParents: party.minParents,
        maxParents: party.maxParents,
        tags: [],
        sortOrder: party.sortOrder,
        updatedAt,
      };
      await db
        .insert(partyPackages)
        .values(values)
        .onConflictDoUpdate({
          target: partyPackages.slug,
          set: values,
        });
    },
  };
}

export async function runLiveBookingCatalogueSeed(
  env: Record<string, string | undefined> = process.env,
  options: LiveBookingCatalogueSeedRunOptions = {},
): Promise<void> {
  assertLiveCatalogueSeedConfirmation(env);
  const loadEnvironment = options.loadEnvironment ?? (() => loadEnv({ env }));
  loadEnvironment();
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const { db, client } = createDb(databaseUrl);
  try {
    await seedLiveBookingCatalogue(createLiveCatalogueSeedStore(db));
    console.log("Live YezYY booking catalogue seeded");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runLiveBookingCatalogueSeed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
