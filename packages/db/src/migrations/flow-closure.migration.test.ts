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

  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1));
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Migration tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return testDatabaseUrl;
}

const generatedSchemas: string[] = [];
let client: Sql | undefined;

function newSchemaName(): string {
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const schema = `yezyy_flow_test_${suffix}`;
  generatedSchemas.push(schema);
  return schema;
}

async function migrationSql(name: string, schema: string): Promise<string> {
  const sqlText = await readFile(`${migrationsDirectory}${name}`, "utf8");
  return sqlText.replaceAll('"public".', `"${schema}".`);
}

async function applyMigration(
  sql: Sql,
  schema: string,
  name: string,
): Promise<void> {
  const contents = await migrationSql(name, schema);
  const statements = contents
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  await sql.unsafe(`SET search_path TO "${schema}"`);
  for (const statement of statements) {
    await sql.unsafe(statement);
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
  "0002 YezYY flow-closure migration (set YEZYY_RUN_DB_MIGRATION_TESTS=1 with a non-production TEST_DATABASE_URL)",
  () => {
    it("applies to an empty schema and enforces slot invariants and restrictive request references", async () => {
      await migrationSql(
        "0002_yezyy_flow_closure.sql",
        "yezyy_flow_artifact_probe",
      );
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = newSchemaName();
      await client.unsafe(`CREATE SCHEMA "${schema}"`);

      await applyMigration(client, schema, "0000_ordinary_captain_britain.sql");
      await applyMigration(client, schema, "0001_nice_ezekiel.sql");
      await applyMigration(client, schema, "0002_yezyy_flow_closure.sql");

      const tables = await client<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_name IN (
            'request_rate_limits',
            'request_status_events',
            'email_outbox',
            'admin_request_reads'
          )
        ORDER BY table_name
      `;
      expect(tables.map(({ table_name }) => table_name)).toEqual([
        "admin_request_reads",
        "email_outbox",
        "request_rate_limits",
        "request_status_events",
      ]);

      await client.unsafe(`SET search_path TO "${schema}"`);
      await expect(
        client`
          INSERT INTO bookings (name, phone, request_kind)
          VALUES ('Customer', '0430000000', 'unsupported')
        `,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        client`
          INSERT INTO time_slots (date, start_time, end_time, capacity)
          VALUES ('2030-01-02', '09:00', '10:00', 0)
        `,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        client`
          INSERT INTO time_slots (date, start_time, end_time, capacity)
          VALUES ('2030-01-02', 'bad', '10:00', 1)
        `,
      ).rejects.toMatchObject({ code: "23514" });

      const [slot] = await client<{ id: string }[]>`
        INSERT INTO time_slots (date, start_time, end_time, capacity)
        VALUES ('2030-01-02', '09:00', '10:00', 2)
        RETURNING id
      `;
      await client`
        INSERT INTO bookings (name, phone, time_slot_id)
        VALUES ('Customer', '0430000000', ${slot.id})
      `;
      await expect(
        client`DELETE FROM time_slots WHERE id = ${slot.id}`,
      ).rejects.toMatchObject({ code: "23503" });

      const [cartSlot] = await client<{ id: string }[]>`
        INSERT INTO time_slots (date, start_time, end_time, capacity)
        VALUES ('2030-01-02', '10:00', '11:00', 2)
        RETURNING id
      `;
      await client`
        INSERT INTO cart_orders (name, phone, time_slot_id)
        VALUES ('Customer', '0430000000', ${cartSlot.id})
      `;
      await expect(
        client`DELETE FROM time_slots WHERE id = ${cartSlot.id}`,
      ).rejects.toMatchObject({ code: "23503" });

      const [user] = await client<{ id: string }[]>`
        INSERT INTO users (email, password_hash, name)
        VALUES ('staff@example.test', 'not-a-real-password-hash', 'Staff')
        RETURNING id
      `;
      await expect(
        client`
          INSERT INTO request_status_events (
            operation_id, from_status, to_status, actor_user_id
          )
          VALUES (
            '00000000-0000-4000-8000-000000000001',
            'new',
            'contacted',
            ${user.id}
          )
        `,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        client`
          INSERT INTO admin_request_reads (user_id)
          VALUES (${user.id})
        `,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        client`
          INSERT INTO email_outbox (
            dedupe_key,
            message_type,
            recipient,
            locale,
            payload,
            delivery_status
          )
          VALUES (
            'invalid-status',
            'request_received',
            'customer@example.test',
            'en',
            '{}'::jsonb,
            'not-a-status'
          )
        `,
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("backfills exact legacy slot snapshots without inventing missing times or rewriting explicit CNY", async () => {
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = newSchemaName();
      await client.unsafe(`CREATE SCHEMA "${schema}"`);

      await applyMigration(client, schema, "0000_ordinary_captain_britain.sql");
      await applyMigration(client, schema, "0001_nice_ezekiel.sql");
      await client.unsafe(`SET search_path TO "${schema}"`);

      const [category] = await client<{ id: string }[]>`
        INSERT INTO project_categories (name, slug)
        VALUES ('{"en":"Craft","zh":"手作"}'::jsonb, 'craft')
        RETURNING id
      `;
      const [slot] = await client<{ id: string }[]>`
        INSERT INTO time_slots (
          date, start_time, end_time, capacity, booked_count, category_id
        )
        VALUES ('2030-02-03', '09:30', '10:30', 4, 1, ${category.id})
        RETURNING id
      `;
      const [withSlot] = await client<{ id: string }[]>`
        INSERT INTO bookings (name, phone, preferred_date, time_slot_id)
        VALUES ('With slot', '0430000001', '2030-02-03', ${slot.id})
        RETURNING id
      `;
      const [withoutSlot] = await client<{ id: string }[]>`
        INSERT INTO bookings (name, phone, preferred_date)
        VALUES ('Without slot', '0430000002', '2030-02-04')
        RETURNING id
      `;
      await client`
        INSERT INTO diy_projects (
          category_id, name, slug, project_type, price_currency
        )
        VALUES (
          ${category.id},
          '{"en":"Historic","zh":"历史"}'::jsonb,
          'historic',
          'product',
          'CNY'
        ), (
          ${category.id},
          '{"en":"Missing currency","zh":"无币种"}'::jsonb,
          'missing-currency',
          'product',
          NULL
        )
      `;

      await applyMigration(client, schema, "0002_yezyy_flow_closure.sql");

      const [snapshotWithSlot] = await client<{
        slot_date: string;
        slot_start_time: string | null;
        slot_end_time: string | null;
        slot_timezone: string;
      }[]>`
        SELECT slot_date::text AS slot_date, slot_start_time, slot_end_time, slot_timezone
        FROM bookings
        WHERE id = ${withSlot.id}
      `;
      expect(snapshotWithSlot).toEqual({
        slot_date: "2030-02-03",
        slot_start_time: "09:30",
        slot_end_time: "10:30",
        slot_timezone: "Australia/Melbourne",
      });

      const [snapshotWithoutSlot] = await client<{
        slot_date: string;
        slot_start_time: string | null;
        slot_end_time: string | null;
      }[]>`
        SELECT slot_date::text AS slot_date, slot_start_time, slot_end_time
        FROM bookings
        WHERE id = ${withoutSlot.id}
      `;
      expect(snapshotWithoutSlot).toEqual({
        slot_date: "2030-02-04",
        slot_start_time: null,
        slot_end_time: null,
      });

      const currencies = await client<{
        slug: string;
        price_currency: string;
      }[]>`
        SELECT slug, price_currency
        FROM diy_projects
        ORDER BY slug
      `;
      expect(currencies).toEqual([
        { slug: "historic", price_currency: "CNY" },
        { slug: "missing-currency", price_currency: "AUD" },
      ]);

      const [columnDefault] = await client<{ column_default: string | null }[]>`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = 'diy_projects'
          AND column_name = 'price_currency'
      `;
      expect(columnDefault.column_default).toContain("'AUD'");
    });

    it("aborts before constraints when legacy slot capacity or time data is invalid", async () => {
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = newSchemaName();
      await client.unsafe(`CREATE SCHEMA "${schema}"`);

      await applyMigration(client, schema, "0000_ordinary_captain_britain.sql");
      await applyMigration(client, schema, "0001_nice_ezekiel.sql");
      await client.unsafe(`SET search_path TO "${schema}"`);
      await client`
        INSERT INTO time_slots (date, start_time, end_time, capacity, booked_count)
        VALUES ('2030-03-01', '10:00', '09:00', 1, 2)
      `;

      await expect(
        applyMigration(client, schema, "0002_yezyy_flow_closure.sql"),
      ).rejects.toThrow(/invalid legacy time_slots/i);
    });
  },
);
