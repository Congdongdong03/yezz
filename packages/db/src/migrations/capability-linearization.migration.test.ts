import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);
const runDatabaseTests =
  process.env.YEZYY_RUN_DB_MIGRATION_TESTS === "1";
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

async function applyThroughCurrent(
  sql: Sql,
  schema: string,
  includeCapabilityMigration: boolean,
) {
  const migrations = [
    "0000_ordinary_captain_britain.sql",
    "0001_nice_ezekiel.sql",
    "0002_yezyy_flow_closure.sql",
    "0003_yezyy_live_booking_operations.sql",
    "0004_slippery_kree.sql",
    "0005_secure_owner_password_setup.sql",
    ...(includeCapabilityMigration
      ? ["0006_capability_gate_linearization.sql"]
      : []),
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
  "0006 capability gate linearization migration",
  () => {
    it("collapses duplicate settings deterministically and folds capabilities fail-closed", async () => {
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = `yezyy_capability_migration_${crypto.randomUUID().replaceAll("-", "")}`;
      generatedSchemas.push(schema);
      await client.unsafe(`CREATE SCHEMA "${schema}"`);
      await applyThroughCurrent(client, schema, false);
      await client.unsafe(`SET search_path TO "${schema}"`);

      await client`
        INSERT INTO site_settings (
          id,
          store_name,
          experience_requests_enabled,
          party_requests_enabled,
          product_requests_enabled,
          created_at,
          updated_at
        )
        VALUES
          (
            '10000000-0000-4000-8000-000000000001',
            'Older enabled row',
            true,
            true,
            true,
            '2026-01-01T00:00:00Z',
            '2026-01-01T00:00:00Z'
          ),
          (
            '10000000-0000-4000-8000-000000000002',
            'Closure evidence',
            false,
            false,
            false,
            '2026-01-02T00:00:00Z',
            '2026-01-02T00:00:00Z'
          ),
          (
            '10000000-0000-4000-8000-000000000003',
            'Newest metadata',
            true,
            true,
            true,
            '2026-01-03T00:00:00Z',
            '2026-01-03T00:00:00Z'
          )
      `;

      await applyMigration(
        client,
        schema,
        "0006_capability_gate_linearization.sql",
      );

      const rows = await client<{
        id: string;
        store_name: string;
        singleton_key: boolean;
        experience_requests_enabled: boolean;
        party_requests_enabled: boolean;
        product_requests_enabled: boolean;
      }[]>`
        SELECT
          id,
          store_name,
          singleton_key,
          experience_requests_enabled,
          party_requests_enabled,
          product_requests_enabled
        FROM site_settings
      `;
      expect(rows).toEqual([
        {
          id: "10000000-0000-4000-8000-000000000003",
          store_name: "Newest metadata",
          singleton_key: true,
          experience_requests_enabled: false,
          party_requests_enabled: false,
          product_requests_enabled: false,
        },
      ]);

      await expect(
        client`
          INSERT INTO site_settings (store_name)
          VALUES ('Second singleton')
        `,
      ).rejects.toMatchObject({ code: "23505" });
    });

    it("keeps an unbootstrapped table empty and permits exactly one bootstrap insert", async () => {
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = `yezyy_capability_empty_${crypto.randomUUID().replaceAll("-", "")}`;
      generatedSchemas.push(schema);
      await client.unsafe(`CREATE SCHEMA "${schema}"`);
      await applyThroughCurrent(client, schema, true);
      await client.unsafe(`SET search_path TO "${schema}"`);

      const [before] = await client<{ count: number }[]>`
        SELECT count(*)::int AS count FROM site_settings
      `;
      expect(before).toEqual({ count: 0 });

      await client`
        INSERT INTO site_settings (store_name)
        VALUES ('Bootstrap singleton')
      `;
      await expect(
        client`
          INSERT INTO site_settings (store_name)
          VALUES ('Concurrent bootstrap')
        `,
      ).rejects.toMatchObject({ code: "23505" });
    });
  },
);
