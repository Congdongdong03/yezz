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
        VALUES (${JSON.stringify(category.name)}::jsonb, ${category.slug}, ${category.sortOrder})
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
          ${project.slug}, 'experience', ${project.priceMinCents}, ${project.priceMaxCents},
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

    const beadingStyles = await migrationClient<
      {
        name: { en: string; zh: string };
        price: string | null;
      }[]
    >`
      SELECT ps.name, ps.price
      FROM project_styles ps
      INNER JOIN diy_projects p ON p.id = ps.project_id
      WHERE p.slug = 'beading'
      ORDER BY ps.sort_order
    `;
    expect(beadingStyles).toEqual([
      { name: { en: "Bracelet", zh: "手链" }, price: "43.00" },
      { name: { en: "Phone Strap 20cm", zh: "手机链 20cm" }, price: "43.00" },
      { name: { en: "Phone Strap 30cm", zh: "手机链 30cm" }, price: "60.50" },
      { name: { en: "Phone Strap 40cm", zh: "手机链 40cm" }, price: "71.50" },
      { name: { en: "Bag Chain", zh: "包链" }, price: "93.50" },
    ]);

    await migrationClient`
      UPDATE catalogue_entries
      SET published = false, cover_image_url = 'https://example.test/owner-phone-case.jpg'
      WHERE slug = 'deco-cream-phone-case'
    `;
    await seedPublicCatalogue(db);

    const [preservedAdminState] = await migrationClient<
      {
        published: boolean;
        cover_image_url: string | null;
      }[]
    >`
      SELECT published, cover_image_url
      FROM catalogue_entries
      WHERE slug = 'deco-cream-phone-case'
    `;
    expect(preservedAdminState).toEqual({
      published: false,
      cover_image_url: "https://example.test/owner-phone-case.jpg",
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
