import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";

const runDatabaseTests = process.env.YEZYY_RUN_DB_MIGRATION_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);
let client: Sql | undefined;
let schema: string | undefined;

async function applyMigration(name: string) {
  const source = await readFile(`${migrationsDirectory}${name}`, "utf8");
  for (const statement of source
    .replaceAll('"public".', `"${schema}".`)
    .split("--> statement-breakpoint")
    .map((candidate) => candidate.trim())
    .filter(Boolean)) {
    await client!.unsafe(statement);
  }
}

afterEach(async () => {
  if (client && schema) {
    await client.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await client?.end();
  client = undefined;
  schema = undefined;
});

describe.skipIf(!runDatabaseTests)(
  "0009 booking photo consent migration",
  () => {
    it("preserves legacy bookings and enforces signed grants", async () => {
      if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) {
        throw new Error("A distinct TEST_DATABASE_URL is required");
      }
      client = postgres(testDatabaseUrl, { max: 1 });
      schema = `photo_consent_${crypto.randomUUID().replaceAll("-", "")}`;
      await client.unsafe(`CREATE SCHEMA "${schema}"`);
      await client.unsafe(`SET search_path TO "${schema}"`);
      for (const migration of [
        "0000_ordinary_captain_britain.sql",
        "0001_nice_ezekiel.sql",
        "0002_yezyy_flow_closure.sql",
        "0003_yezyy_live_booking_operations.sql",
        "0004_slippery_kree.sql",
        "0005_secure_owner_password_setup.sql",
        "0006_capability_gate_linearization.sql",
        "0007_yezyy_public_catalogue.sql",
        "0008_lucky_scarlet_witch.sql",
      ]) {
        await applyMigration(migration);
      }
      const [legacy] = await client<{ id: string }[]>`
      INSERT INTO bookings (name, phone) VALUES ('Legacy', '0430000000')
      RETURNING id
    `;

      await applyMigration("0009_booking_photo_consent.sql");

      const [preserved] = await client<
        Array<{ decision: string | null; version: string | null }>
      >`
      SELECT photo_consent_decision AS decision,
             photo_consent_version AS version
      FROM bookings WHERE id = ${legacy!.id}
    `;
      expect(preserved).toEqual({ decision: null, version: null });

      await expect(
        client`
        INSERT INTO bookings (
          name, phone, photo_consent_decision, photo_consent_signer_name,
          photo_consent_version, photo_consent_recorded_at
        ) VALUES (
          'Guardian', '0430000001', 'guardian_for_minor', 'Parent Name',
          '2026-08-03', now()
        )
      `,
      ).resolves.toBeDefined();
      await expect(
        client`
        INSERT INTO bookings (
          name, phone, photo_consent_decision, photo_consent_version,
          photo_consent_recorded_at
        ) VALUES ('Unsigned', '0430000002', 'adult_only', '2026-08-03', now())
      `,
      ).rejects.toMatchObject({ code: "23514" });
    });
  },
);
