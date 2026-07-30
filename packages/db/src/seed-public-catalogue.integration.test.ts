import { drizzle } from "drizzle-orm/postgres-js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import type { Db } from "./client.js";
import {
  LIVE_DIY_PROJECTS,
  LIVE_PROJECT_CATEGORIES,
} from "./live-booking-catalogue.js";
import { seedPublicCatalogue } from "./seed-public-catalogue.js";
import * as schema from "./schema/index.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_CATALOGUE_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

let migrationClient: Sql | undefined;
let applicationClient: Sql | undefined;
let testSchema: string | undefined;

function requireSafeTestDatabaseUrl(): string {
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_DB_CATALOGUE_TESTS=1",
    );
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Catalogue seed integration refuses TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }
  const databaseName = decodeURIComponent(
    new URL(testDatabaseUrl).pathname.slice(1),
  );
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Catalogue seed integration refuses database "${databaseName}"`,
    );
  }
  return testDatabaseUrl;
}

function withSearchPath(url: string, schemaName: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-csearch_path=${schemaName}`);
  return parsed.toString();
}

async function applyMigration(
  client: Sql,
  schemaName: string,
  migrationName: string,
) {
  const source = await readFile(
    `${migrationsDirectory}${migrationName}`,
    "utf8",
  );
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
  for (const migration of [
    "0000_ordinary_captain_britain.sql",
    "0001_nice_ezekiel.sql",
    "0002_yezyy_flow_closure.sql",
    "0003_yezyy_live_booking_operations.sql",
    "0004_slippery_kree.sql",
    "0005_secure_owner_password_setup.sql",
    "0006_capability_gate_linearization.sql",
    "0007_yezyy_public_catalogue.sql",
  ]) {
    await applyMigration(client, schemaName, migration);
  }
}

afterEach(async () => {
  await applicationClient?.end();
  applicationClient = undefined;
  if (migrationClient && testSchema) {
    await migrationClient.unsafe(
      `DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`,
    );
  }
  await migrationClient?.end();
  migrationClient = undefined;
  testSchema = undefined;
});

describe.skipIf(!runDatabaseTests)("public catalogue PostgreSQL seed", () => {
  it("publishes the nine approved entries idempotently without changing operational booking state", async () => {
    migrationClient = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
    testSchema = `yezyy_public_catalogue_seed_${crypto.randomUUID().replaceAll("-", "")}`;
    await migrationClient.unsafe(`CREATE SCHEMA "${testSchema}"`);
    await applyCurrentMigrations(migrationClient, testSchema);
    await migrationClient.unsafe(`SET search_path TO "${testSchema}"`);

    const categoryIdBySlug = new Map<string, string>();
    for (const category of LIVE_PROJECT_CATEGORIES) {
      const [row] = await migrationClient<{ id: string }[]>`
        INSERT INTO project_categories (name, slug, sort_order)
        VALUES (${JSON.stringify(category.name)}::jsonb, ${category.slug}, ${category.sortOrder + 20})
        RETURNING id
      `;
      categoryIdBySlug.set(category.slug, row.id);
    }

    const expectedBookableBySlug: Array<{ slug: string; bookable: boolean }> =
      [];
    const projectIdBySlug = new Map<string, string>();
    for (const [sortOrder, project] of LIVE_DIY_PROJECTS.entries()) {
      const [row] = await migrationClient<{ id: string }[]>`
        INSERT INTO diy_projects (
          category_id, name, slug, project_type, price_min, price_max,
          price_currency, duration_minutes, bookable, variant_selected_in_store, sort_order
        ) VALUES (
          ${categoryIdBySlug.get(project.categorySlug)!}, ${JSON.stringify(project.name)}::jsonb,
          ${project.slug}, 'experience', ${project.slug === "air-dry-phone-case" ? 6600 : project.slug === "air-dry-lamp" ? 4300 : project.priceMinCents}, ${project.slug === "air-dry-phone-case" || project.slug === "air-dry-lamp" ? 4300 : project.priceMaxCents},
          'AUD', ${project.durationMinutes}, ${sortOrder % 2 === 0}, ${project.variantSelectedInStore}, ${sortOrder}
        )
        RETURNING id
      `;
      projectIdBySlug.set(project.slug, row.id);
      expectedBookableBySlug.push({
        slug: project.slug,
        bookable: sortOrder % 2 === 0,
      });
    }

    const staleBeadingStyles = await migrationClient<{ id: string }[]>`
      INSERT INTO project_styles (project_id, name, price, sort_order)
      VALUES
        (${projectIdBySlug.get("beading")!}, '{"en":"Old bracelet","zh":"旧手链"}'::jsonb, '1.00', 0),
        (${projectIdBySlug.get("beading")!}, '{"en":"Old phone strap","zh":"旧手机链"}'::jsonb, '2.00', 1)
      RETURNING id
    `;

    applicationClient = postgres(
      withSearchPath(requireSafeTestDatabaseUrl(), testSchema),
      { max: 2 },
    );
    const db = drizzle(applicationClient, { schema }) as unknown as Db;
    await seedPublicCatalogue(db);
    await seedPublicCatalogue(db);

    const published = await migrationClient<
      {
        slug: string;
        published: boolean;
      }[]
    >`
      SELECT slug, published FROM catalogue_entries WHERE published = true ORDER BY slug
    `;
    expect(published).toHaveLength(9);

    const plasterLinks = await migrationClient<{ project_id: string }[]>`
      SELECT cep.project_id
      FROM catalogue_entry_projects cep
      INNER JOIN catalogue_entries ce ON ce.id = cep.catalogue_entry_id
      WHERE ce.slug = 'plaster-painting'
      ORDER BY cep.sort_order
    `;
    expect(plasterLinks).toEqual([
      { project_id: projectIdBySlug.get("paint-clay-figurine-mini") },
      { project_id: projectIdBySlug.get("paint-clay-figurine-small") },
      { project_id: projectIdBySlug.get("paint-clay-figurine-medium") },
      { project_id: projectIdBySlug.get("paint-clay-figurine-large") },
    ]);

    const bookableAfterSeed = await migrationClient<
      {
        slug: string;
        bookable: boolean;
      }[]
    >`
      SELECT slug, bookable FROM diy_projects ORDER BY sort_order
    `;
    expect(bookableAfterSeed).toEqual(expectedBookableBySlug);

    const reconciledPrices = await migrationClient<
      { slug: string; price_min: number; price_max: number }[]
    >`
      SELECT slug, price_min, price_max
      FROM diy_projects
      WHERE slug IN ('air-dry-phone-case', 'air-dry-lamp')
      ORDER BY slug
    `;
    expect(reconciledPrices).toEqual([
      { slug: "air-dry-lamp", price_min: 4300, price_max: 9800 },
      { slug: "air-dry-phone-case", price_min: 6600, price_max: 7600 },
    ]);

    const categoryOrder = await migrationClient<
      { slug: string; sort_order: number }[]
    >`
      SELECT slug, sort_order
      FROM project_categories
      WHERE slug IN ('air-dry-cream-piping', 'paint-clay', 'beading', 'melty-beads')
      ORDER BY sort_order
    `;
    expect(categoryOrder).toEqual([
      { slug: "air-dry-cream-piping", sort_order: 0 },
      { slug: "paint-clay", sort_order: 1 },
      { slug: "beading", sort_order: 2 },
      { slug: "melty-beads", sort_order: 3 },
    ]);

    const beadingStyles = await migrationClient<
      {
        id: string;
        name: { en: string; zh: string };
        price: string | null;
      }[]
    >`
      SELECT ps.id, ps.name, ps.price
      FROM project_styles ps
      INNER JOIN diy_projects p ON p.id = ps.project_id
      WHERE p.slug = 'beading'
      ORDER BY ps.sort_order
    `;
    expect(beadingStyles).toEqual([
      { id: staleBeadingStyles[0]?.id, name: { en: "Bracelet", zh: "手链" }, price: "43.00" },
      { id: staleBeadingStyles[1]?.id, name: { en: "Phone Strap 20cm", zh: "手机链 20cm" }, price: "43.00" },
      { id: expect.any(String), name: { en: "Phone Strap 30cm", zh: "手机链 30cm" }, price: "60.50" },
      { id: expect.any(String), name: { en: "Phone Strap 40cm", zh: "手机链 40cm" }, price: "71.50" },
      { id: expect.any(String), name: { en: "Bag Chain", zh: "包链" }, price: "93.50" },
    ]);

    await migrationClient`
      UPDATE catalogue_entries
      SET
        published = false,
        cover_image_url = 'https://example.test/owner-phone-case.jpg',
        image_kind = 'yezyy',
        image_source_url = 'https://example.test/owner-source.jpg',
        image_license_url = 'https://example.test/owner-licence',
        image_attribution = '{"en":"Owner","zh":"店主"}'::jsonb
      WHERE slug = 'deco-cream-phone-case'
    `;
    await seedPublicCatalogue(db);

    const [preservedAdminState] = await migrationClient<
      {
        published: boolean;
        cover_image_url: string | null;
        image_kind: string;
        image_source_url: string | null;
        image_license_url: string | null;
        image_attribution: { en: string; zh: string } | null;
      }[]
    >`
      SELECT published, cover_image_url, image_kind, image_source_url,
        image_license_url, image_attribution
      FROM catalogue_entries
      WHERE slug = 'deco-cream-phone-case'
    `;
    expect(preservedAdminState).toEqual({
      published: false,
      cover_image_url: "https://example.test/owner-phone-case.jpg",
      image_kind: "yezyy",
      image_source_url: "https://example.test/owner-source.jpg",
      image_license_url: "https://example.test/owner-licence",
      image_attribution: { en: "Owner", zh: "店主" },
    });

    const [counts] = await migrationClient<
      {
        entries: number;
        links: number;
      }[]
    >`
      SELECT
        (SELECT count(*)::int FROM catalogue_entries) AS entries,
        (SELECT count(*)::int FROM catalogue_entry_projects) AS links
    `;
    expect(counts).toEqual({ entries: 9, links: 12 });
  });
});
