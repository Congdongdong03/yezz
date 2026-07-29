import { drizzle } from "drizzle-orm/postgres-js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import type { Db } from "./client.js";
import {
  LIVE_DIY_PROJECTS,
  LIVE_PARTY_PACKAGES,
  LIVE_PROJECT_CATEGORIES,
} from "./live-booking-catalogue.js";
import { createLiveCatalogueSeedStore, seedLiveBookingCatalogue } from "./seed-live-booking-catalogue.js";
import * as schema from "./schema/index.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_MIGRATION_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));

let migrationClient: Sql | undefined;
let applicationClient: Sql | undefined;
let testSchema: string | undefined;

function requireSafeTestDatabaseUrl(): string {
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required when YEZYY_RUN_DB_MIGRATION_TESTS=1");
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error("Seed integration refuses TEST_DATABASE_URL when it equals DATABASE_URL");
  }
  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1));
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(`Seed integration refuses database "${databaseName}"`);
  }
  return testDatabaseUrl;
}

function withSearchPath(url: string, schemaName: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-csearch_path=${schemaName}`);
  return parsed.toString();
}

async function applyMigration(client: Sql, schemaName: string, migrationName: string) {
  const source = await readFile(`${migrationsDirectory}${migrationName}`, "utf8");
  await client.unsafe(`SET search_path TO "${schemaName}"`);
  for (const statement of source
    .replaceAll('"public".', `"${schemaName}".`)
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)) {
    await client.unsafe(statement);
  }
}

async function applyCurrentMigrations(client: Sql, schemaName: string) {
  await applyMigration(client, schemaName, "0000_ordinary_captain_britain.sql");
  await applyMigration(client, schemaName, "0001_nice_ezekiel.sql");
  await applyMigration(client, schemaName, "0002_yezyy_flow_closure.sql");
  await applyMigration(client, schemaName, "0003_yezyy_live_booking_operations.sql");
}

function formatAudCents(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

afterEach(async () => {
  await applicationClient?.end();
  applicationClient = undefined;
  if (migrationClient && testSchema) {
    await migrationClient.unsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
  }
  await migrationClient?.end();
  migrationClient = undefined;
  testSchema = undefined;
});

describe.skipIf(!runDatabaseTests)(
  "live booking catalogue PostgreSQL adapter",
  () => {
    it("upserts only the approved slugs twice while preserving settings, legacy rows, and image records", async () => {
      migrationClient = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      testSchema = `yezyy_live_catalogue_${crypto.randomUUID().replaceAll("-", "")}`;
      await migrationClient.unsafe(`CREATE SCHEMA "${testSchema}"`);
      await applyCurrentMigrations(migrationClient, testSchema);
      await migrationClient.unsafe(`SET search_path TO "${testSchema}"`);

      const [legacyCategory] = await migrationClient<{ id: string }[]>`
        INSERT INTO project_categories (name, slug)
        VALUES ('{"en":"Legacy category","zh":"旧分类"}'::jsonb, 'legacy-category')
        RETURNING id
      `;
      await migrationClient`
        INSERT INTO project_categories (name, slug, sort_order)
        VALUES ('{"en":"Wrong","zh":"错误"}'::jsonb, 'melty-beads', 99)
      `;
      const [legacyProject] = await migrationClient<{ id: string }[]>`
        INSERT INTO diy_projects (
          category_id, name, slug, project_type, price_range, price_min, price_max,
          price_currency, duration, duration_minutes, bookable, variant_selected_in_store,
          tags, sort_order, cover_image_url
        ) VALUES (
          ${legacyCategory.id}, '{"en":"Legacy project","zh":"旧项目"}'::jsonb,
          'legacy-project', 'experience', '$7', 700, 700, 'AUD', '30 minutes', 30,
          true, false, ARRAY['legacy'], 77, 'https://example.test/legacy-cover.jpg'
        )
        RETURNING id
      `;
      await migrationClient`
        INSERT INTO project_images (project_id, url, sort_order)
        VALUES (${legacyProject.id}, 'https://example.test/legacy-image.jpg', 0)
      `;
      await migrationClient`
        INSERT INTO diy_projects (
          category_id, name, slug, project_type, price_range, price_min, price_max,
          price_currency, duration, duration_minutes, bookable, variant_selected_in_store,
          extra_time_minutes, extra_time_price_cents, tags, sort_order, cover_image_url
        ) VALUES (
          ${legacyCategory.id}, '{"en":"Wrong melty","zh":"错误拼豆"}'::jsonb,
          'melty-bead-craft', 'product', '$1', 1, 2, 'CNY', 'wrong', 30, true, true,
          60, 999, ARRAY['wrong'], 88, 'https://example.test/wrong-cover.jpg'
        )
      `;
      await migrationClient`
        INSERT INTO party_packages (
          name, slug, description, includes, cover_image_url, image_urls, min_people,
          max_people, price_indicator, guest_duration_minutes, setup_minutes, cleanup_minutes,
          venue_fee_cents, min_spend_per_person_cents, min_parents, max_parents, tags, sort_order
        ) VALUES (
          '{"en":"Legacy party","zh":"旧派对"}'::jsonb, 'legacy-party',
          '{"en":"Keep","zh":"保留"}'::jsonb, '[]'::jsonb, 'https://example.test/legacy-party.jpg',
          ARRAY['https://example.test/legacy-party.jpg'], 3, 9, 'legacy', 30, 1, 1, 1, 1, 1, 1,
          ARRAY['legacy'], 77
        )
      `;
      await migrationClient`
        INSERT INTO party_packages (
          name, slug, includes, min_people, max_people, guest_duration_minutes, setup_minutes,
          cleanup_minutes, venue_fee_cents, min_spend_per_person_cents, min_parents, max_parents
        ) VALUES (
          '{"en":"Wrong party","zh":"错误派对"}'::jsonb, 'party-90', '[]'::jsonb,
          1, 20, 30, 1, 1, 1, 1, 1, 1
        )
      `;
      const [settings] = await migrationClient<{
        experience_requests_enabled: boolean;
        party_requests_enabled: boolean;
        product_requests_enabled: boolean;
      }[]>`
        INSERT INTO site_settings (
          store_name, experience_requests_enabled, party_requests_enabled, product_requests_enabled
        ) VALUES ('Sentinel settings', true, false, true)
        RETURNING experience_requests_enabled, party_requests_enabled, product_requests_enabled
      `;
      expect(settings).toEqual({
        experience_requests_enabled: true,
        party_requests_enabled: false,
        product_requests_enabled: true,
      });
      await migrationClient.unsafe(`
        CREATE FUNCTION reject_live_catalogue_unrelated_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unexpected catalogue seed mutation'; END $$;
        CREATE TRIGGER reject_site_settings_mutation BEFORE INSERT OR UPDATE OR DELETE ON site_settings
        FOR EACH STATEMENT EXECUTE FUNCTION reject_live_catalogue_unrelated_mutation();
        CREATE TRIGGER reject_project_images_mutation BEFORE INSERT OR UPDATE OR DELETE ON project_images
        FOR EACH STATEMENT EXECUTE FUNCTION reject_live_catalogue_unrelated_mutation();
      `);

      applicationClient = postgres(withSearchPath(requireSafeTestDatabaseUrl(), testSchema), { max: 2 });
      const db = drizzle(applicationClient, { schema }) as unknown as Db;
      const store = createLiveCatalogueSeedStore(db);
      await seedLiveBookingCatalogue(store);
      await seedLiveBookingCatalogue(store);

      const [counts] = await migrationClient<{
        categories: number;
        projects: number;
        parties: number;
        images: number;
        settings: number;
      }[]>`
        SELECT
          (SELECT count(*)::int FROM project_categories) AS categories,
          (SELECT count(*)::int FROM diy_projects) AS projects,
          (SELECT count(*)::int FROM party_packages) AS parties,
          (SELECT count(*)::int FROM project_images) AS images,
          (SELECT count(*)::int FROM site_settings) AS settings
      `;
      expect(counts).toEqual({ categories: 5, projects: 29, parties: 3, images: 1, settings: 1 });

      const persistedCategories = await migrationClient<{
        slug: string;
        name: { en: string; zh: string };
        sort_order: number;
      }[]>`
        SELECT slug, name, sort_order FROM project_categories
        WHERE slug <> 'legacy-category'
        ORDER BY sort_order
      `;
      expect(persistedCategories).toEqual(LIVE_PROJECT_CATEGORIES.map((category) => ({
        slug: category.slug,
        name: category.name,
        sort_order: category.sortOrder,
      })));

      const persistedProjects = await migrationClient<{
        category_slug: string;
        slug: string;
        name: { en: string; zh: string };
        project_type: string;
        price_range: string | null;
        price_min: number | null;
        price_max: number | null;
        price_currency: string | null;
        duration: string | null;
        duration_minutes: number | null;
        bookable: boolean;
        variant_selected_in_store: boolean;
        extra_time_minutes: number | null;
        extra_time_price_cents: number | null;
        tags: string[] | null;
        sort_order: number;
        cover_image_url: string | null;
      }[]>`
        SELECT c.slug AS category_slug, p.slug, p.name, p.project_type::text AS project_type,
          p.price_range, p.price_min, p.price_max, p.price_currency, p.duration,
          p.duration_minutes, p.bookable, p.variant_selected_in_store, p.extra_time_minutes,
          p.extra_time_price_cents, p.tags, p.sort_order, p.cover_image_url
        FROM diy_projects p
        INNER JOIN project_categories c ON c.id = p.category_id
        WHERE p.slug <> 'legacy-project'
        ORDER BY p.sort_order
      `;
      expect(persistedProjects).toEqual(LIVE_DIY_PROJECTS.map((project, sortOrder) => ({
        category_slug: project.categorySlug,
        slug: project.slug,
        name: project.name,
        project_type: "experience",
        price_range: formatAudCents(project.priceMinCents),
        price_min: project.priceMinCents,
        price_max: project.priceMaxCents,
        price_currency: "AUD",
        duration: `${project.durationMinutes} minutes`,
        duration_minutes: project.durationMinutes,
        bookable: false,
        variant_selected_in_store: project.variantSelectedInStore,
        extra_time_minutes: "extraTimeMinutes" in project ? project.extraTimeMinutes : null,
        extra_time_price_cents: "extraTimePriceCents" in project ? project.extraTimePriceCents : null,
        tags: [],
        sort_order: sortOrder,
        cover_image_url: null,
      })));

      const persistedParties = await migrationClient<{
        slug: string;
        name: { en: string; zh: string };
        min_people: number;
        max_people: number;
        guest_duration_minutes: number | null;
        setup_minutes: number | null;
        cleanup_minutes: number | null;
        venue_fee_cents: number | null;
        min_spend_per_person_cents: number | null;
        min_parents: number;
        max_parents: number;
        cover_image_url: string | null;
        image_urls: string[];
        sort_order: number;
      }[]>`
        SELECT slug, name, min_people, max_people, guest_duration_minutes, setup_minutes,
          cleanup_minutes, venue_fee_cents, min_spend_per_person_cents, min_parents, max_parents,
          cover_image_url, image_urls, sort_order
        FROM party_packages WHERE slug <> 'legacy-party' ORDER BY sort_order
      `;
      expect(persistedParties).toEqual(LIVE_PARTY_PACKAGES.map((party, sortOrder) => ({
        slug: party.slug,
        name: party.name,
        min_people: party.minPeople,
        max_people: party.maxPeople,
        guest_duration_minutes: party.guestDurationMinutes,
        setup_minutes: party.setupMinutes,
        cleanup_minutes: party.cleanupMinutes,
        venue_fee_cents: party.venueFeeCents,
        min_spend_per_person_cents: party.minSpendPerPersonCents,
        min_parents: party.minParents,
        max_parents: party.maxParents,
        cover_image_url: null,
        image_urls: [],
        sort_order: sortOrder,
      })));

      const [preserved] = await migrationClient<{
        legacy_project_cover: string;
        legacy_party_cover: string;
        image_url: string;
        store_name: string;
        experience_requests_enabled: boolean;
        party_requests_enabled: boolean;
        product_requests_enabled: boolean;
      }[]>`
        SELECT
          (SELECT cover_image_url FROM diy_projects WHERE slug = 'legacy-project') AS legacy_project_cover,
          (SELECT cover_image_url FROM party_packages WHERE slug = 'legacy-party') AS legacy_party_cover,
          (SELECT url FROM project_images LIMIT 1) AS image_url,
          (SELECT store_name FROM site_settings LIMIT 1) AS store_name,
          (SELECT experience_requests_enabled FROM site_settings LIMIT 1) AS experience_requests_enabled,
          (SELECT party_requests_enabled FROM site_settings LIMIT 1) AS party_requests_enabled,
          (SELECT product_requests_enabled FROM site_settings LIMIT 1) AS product_requests_enabled
      `;
      expect(preserved).toEqual({
        legacy_project_cover: "https://example.test/legacy-cover.jpg",
        legacy_party_cover: "https://example.test/legacy-party.jpg",
        image_url: "https://example.test/legacy-image.jpg",
        store_name: "Sentinel settings",
        experience_requests_enabled: true,
        party_requests_enabled: false,
        product_requests_enabled: true,
      });
    });
  },
);
