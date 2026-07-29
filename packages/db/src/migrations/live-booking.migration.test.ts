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
  const schema = `yezyy_live_booking_test_${crypto.randomUUID().replaceAll("-", "")}`;
  generatedSchemas.push(schema);
  return schema;
}

async function migrationSql(name: string, schema: string): Promise<string> {
  const sqlText = await readFile(`${migrationsDirectory}${name}`, "utf8");
  return sqlText.replaceAll('"public".', `"${schema}".`);
}

async function applyMigration(sql: Sql, schema: string, name: string): Promise<void> {
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

async function applyThroughLiveBooking(sql: Sql, schema: string): Promise<void> {
  await applyMigration(sql, schema, "0000_ordinary_captain_britain.sql");
  await applyMigration(sql, schema, "0001_nice_ezekiel.sql");
  await applyMigration(sql, schema, "0002_yezyy_flow_closure.sql");
  await applyMigration(sql, schema, "0003_yezyy_live_booking_operations.sql");
  await applyMigration(sql, schema, "0004_slippery_kree.sql");
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
  "0003 YezYY live booking operations migration (set YEZYY_RUN_DB_MIGRATION_TESTS=1 with a non-production TEST_DATABASE_URL)",
  () => {
    it("applies to an empty schema with closed public switches and operational constraints", async () => {
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = newSchemaName();
      await client.unsafe(`CREATE SCHEMA "${schema}"`);
      await applyThroughLiveBooking(client, schema);

      const tables = await client<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_name IN (
            'booking_charges', 'booking_items', 'booking_party_details',
            'customer_action_tokens', 'password_setup_tokens',
            'studio_closures', 'studio_special_hours', 'studio_weekly_hours'
          )
        ORDER BY table_name
      `;
      expect(tables.map(({ table_name }) => table_name)).toEqual([
        "booking_charges",
        "booking_items",
        "booking_party_details",
        "customer_action_tokens",
        "password_setup_tokens",
        "studio_closures",
        "studio_special_hours",
        "studio_weekly_hours",
      ]);

      await client.unsafe(`SET search_path TO "${schema}"`);
      const hours = await client<{ weekday: number; opens_at: string; closes_at: string; is_closed: boolean }[]>`
        SELECT weekday, opens_at, closes_at, is_closed
        FROM studio_weekly_hours
        ORDER BY weekday
      `;
      expect(hours).toEqual([
        { weekday: 0, opens_at: "10:00", closes_at: "17:00", is_closed: false },
        { weekday: 1, opens_at: "09:30", closes_at: "17:00", is_closed: false },
        { weekday: 2, opens_at: "09:30", closes_at: "17:00", is_closed: false },
        { weekday: 3, opens_at: "09:30", closes_at: "17:00", is_closed: false },
        { weekday: 4, opens_at: "09:30", closes_at: "20:30", is_closed: false },
        { weekday: 5, opens_at: "09:30", closes_at: "20:30", is_closed: false },
        { weekday: 6, opens_at: "09:30", closes_at: "17:30", is_closed: false },
      ]);

      const [settings] = await client<{
        experience_requests_enabled: boolean;
        party_requests_enabled: boolean;
        product_requests_enabled: boolean;
      }[]>`
        INSERT INTO site_settings (store_name)
        VALUES ('YezYY')
        RETURNING experience_requests_enabled, party_requests_enabled, product_requests_enabled
      `;
      expect(settings).toEqual({
        experience_requests_enabled: false,
        party_requests_enabled: false,
        product_requests_enabled: false,
      });

      const [requestColumn] = await client<{ data_type: string }[]>`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = 'request_status_events'
          AND column_name = 'customer_reschedule_request'
      `;
      expect(requestColumn).toEqual({ data_type: "jsonb" });

      const [owner] = await client<{ role: string; session_version: number }[]>`
        INSERT INTO users (email, password_hash, name, role)
        VALUES ('owner@example.test', 'not-a-real-password-hash', 'Owner', 'owner')
        RETURNING role, session_version
      `;
      expect(owner).toEqual({ role: "owner", session_version: 0 });

      await expect(
        client`
          INSERT INTO studio_weekly_hours (weekday, opens_at, closes_at)
          VALUES (7, '09:30', '17:00')
        `,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        client`
          INSERT INTO studio_special_hours (date, opens_at, closes_at, is_closed)
          VALUES ('2030-01-01', '09:30', '17:00', true)
        `,
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("upgrades legacy records without changing cart orders or fabricating party payment", async () => {
      client = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      const schema = newSchemaName();
      await client.unsafe(`CREATE SCHEMA "${schema}"`);
      await applyMigration(client, schema, "0000_ordinary_captain_britain.sql");
      await applyMigration(client, schema, "0001_nice_ezekiel.sql");
      await applyMigration(client, schema, "0002_yezyy_flow_closure.sql");
      await client.unsafe(`SET search_path TO "${schema}"`);

      const [legacyUser] = await client<{ id: string; role: string }[]>`
        INSERT INTO users (email, password_hash, name, role)
        VALUES ('admin@example.test', 'not-a-real-password-hash', 'Admin', 'admin')
        RETURNING id, role
      `;
      const [party] = await client<{ id: string }[]>`
        INSERT INTO party_packages (name, slug)
        VALUES ('{"en":"Party","zh":"派对"}'::jsonb, 'legacy-party')
        RETURNING id
      `;
      const [confirmedBooking] = await client<{ id: string }[]>`
        INSERT INTO bookings (name, phone, request_kind, party_package_id, status)
        VALUES ('Legacy party', '0430000000', 'party', ${party.id}, 'confirmed')
        RETURNING id
      `;
      const [cartOrder] = await client<{ id: string; status: string }[]>`
        INSERT INTO cart_orders (name, phone, status)
        VALUES ('Legacy cart', '0430000001', 'confirmed')
        RETURNING id, status::text AS status
      `;

      await applyMigration(client, schema, "0003_yezyy_live_booking_operations.sql");
      await applyMigration(client, schema, "0004_slippery_kree.sql");

      const [booking] = await client<{
        status: string;
        paid_at: string | null;
        paid_amount_cents: number | null;
      }[]>`
        SELECT b.status, p.paid_at::text AS paid_at, p.paid_amount_cents
        FROM bookings b
        LEFT JOIN booking_party_details p ON p.booking_id = b.id
        WHERE b.id = ${confirmedBooking.id}
      `;
      expect(booking).toEqual({
        status: "confirmed",
        paid_at: null,
        paid_amount_cents: null,
      });

      const [preservedCart] = await client<{ status: string }[]>`
        SELECT status::text AS status FROM cart_orders WHERE id = ${cartOrder.id}
      `;
      expect(preservedCart).toEqual({ status: "confirmed" });

      const [preservedUser] = await client<{ role: string; session_version: number }[]>`
        SELECT role::text AS role, session_version FROM users WHERE id = ${legacyUser.id}
      `;
      expect(preservedUser).toEqual({ role: "admin", session_version: 0 });
    });
  },
);
