import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);
const runDatabaseTests = process.env.YEZYY_RUN_DB_MIGRATION_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function requireSafeTestDatabaseUrl(): string {
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_DB_MIGRATION_TESTS=1",
    );
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Migration tests refuse to use TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }
  const databaseName = decodeURIComponent(
    new URL(testDatabaseUrl).pathname.slice(1),
  );
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Migration tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return testDatabaseUrl;
}

const generatedSchemas: string[] = [];
let client: Sql | undefined;

async function applyMigration(
  sql: Sql,
  schema: string,
  name: string,
): Promise<void> {
  const source = await readFile(`${migrationsDirectory}${name}`, "utf8");
  const statements = source
    .replaceAll('"public".', `"${schema}".`)
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await sql.unsafe(`SET search_path TO "${schema}"`);
  for (const statement of statements) {
    await sql.unsafe(statement);
  }
}

async function applyThroughCapability(sql: Sql, schema: string): Promise<void> {
  const migrations = [
    "0000_ordinary_captain_britain.sql",
    "0001_nice_ezekiel.sql",
    "0002_yezyy_flow_closure.sql",
    "0003_yezyy_live_booking_operations.sql",
    "0004_slippery_kree.sql",
    "0005_secure_owner_password_setup.sql",
    "0006_capability_gate_linearization.sql",
  ];
  for (const migration of migrations) {
    await applyMigration(sql, schema, migration);
  }
}

afterEach(async () => {
  if (!client) return;
  for (const schema of generatedSchemas.splice(0)) {
    await client.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await client.end();
  client = undefined;
});

describe.skipIf(!runDatabaseTests)(
  "0007 public catalogue migration",
  () => {
    it("adds catalogue publication and project grouping without changing bookable", async () => {
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = `yezyy_public_catalogue_${crypto.randomUUID().replaceAll("-", "")}`;
      generatedSchemas.push(schema);
      await client.unsafe(`CREATE SCHEMA "${schema}"`);
      await applyThroughCapability(client, schema);
      await client.unsafe(`SET search_path TO "${schema}"`);

      const [category] = await client<{ id: string }[]>`
        INSERT INTO project_categories (name, slug)
        VALUES ('{"en":"Existing category","zh":"现有分类"}'::jsonb, 'existing-category')
        RETURNING id
      `;
      const [project] = await client<{ id: string }[]>`
        INSERT INTO diy_projects (category_id, name, slug, project_type, bookable)
        VALUES (
          ${category.id},
          '{"en":"Existing project","zh":"现有项目"}'::jsonb,
          'existing-project',
          'experience',
          true
        )
        RETURNING id
      `;

      await applyMigration(client, schema, "0007_yezyy_public_catalogue.sql");

      const columns = await client<{
        published: boolean;
        featured: boolean;
        imageKind: string;
      }[]>`
        select published, featured, image_kind as "imageKind"
        from catalogue_entries
        where false
      `;
      expect(columns).toEqual([]);

      const links = await client<{ total: number }[]>`
        select count(*)::int as total from catalogue_entry_projects
      `;
      expect(links[0]?.total).toBe(0);

      const [preservedProject] = await client<{ id: string; bookable: boolean }[]>`
        SELECT id, bookable FROM diy_projects WHERE id = ${project.id}
      `;
      expect(preservedProject).toEqual({ id: project.id, bookable: true });

      const [settings] = await client<{
        experience_requests_enabled: boolean;
        party_requests_enabled: boolean;
        product_requests_enabled: boolean;
      }[]>`
        INSERT INTO site_settings (store_name)
        VALUES ('Catalogue migration settings')
        RETURNING
          experience_requests_enabled,
          party_requests_enabled,
          product_requests_enabled
      `;
      expect(settings).toEqual({
        experience_requests_enabled: false,
        party_requests_enabled: false,
        product_requests_enabled: false,
      });
    });
  },
);
