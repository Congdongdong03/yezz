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

describe.skipIf(!runDatabaseTests)("0008 password setup outbox security migration", () => {
  it("revokes legacy links and removes raw setup URLs from durable storage", async () => {
    if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) {
      throw new Error("A distinct TEST_DATABASE_URL is required");
    }
    client = postgres(testDatabaseUrl, { max: 1 });
    schema = `password_setup_outbox_${crypto.randomUUID().replaceAll("-", "")}`;
    await client.unsafe(`CREATE SCHEMA "${schema}"`);
    await client.unsafe(`SET search_path TO "${schema}"`);
    for (const migration of [
      "0000_ordinary_captain_britain.sql",
      "0001_nice_ezekiel.sql",
      "0002_yezyy_flow_closure.sql",
      "0003_yezyy_live_booking_operations.sql",
      "0004_slippery_kree.sql",
      "0005_secure_owner_password_setup.sql",
    ]) {
      await applyMigration(migration);
    }

    const [user] = await client<{ id: string }[]>`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('owner@example.test', 'hash', 'Owner', 'owner')
      RETURNING id
    `;
    const [token] = await client<{ id: string }[]>`
      INSERT INTO password_setup_tokens (user_id, token_digest, expires_at)
      VALUES (${user!.id}, ${"a".repeat(64)}, now() + interval '1 hour')
      RETURNING id
    `;
    const rawToken = "R".repeat(43);
    await client`
      INSERT INTO email_outbox (
        dedupe_key, message_type, recipient, locale, payload
      ) VALUES (
        ${`admin-password-setup:${token!.id}`},
        'admin_password_setup',
        'owner@example.test',
        'en',
        ${client.json({
          template: "admin_password_setup",
          setupUrl: `https://yezyy.com/admin/setup-password?token=${rawToken}`,
        })}
      )
    `;

    await applyMigration("0008_lucky_scarlet_witch.sql");

    const [result] = await client<
      Array<{
        revoked: boolean;
        deliveryStatus: string;
        payload: Record<string, unknown>;
        lastError: string | null;
      }>
    >`
      SELECT
        password_setup_tokens.revoked_at IS NOT NULL AS revoked,
        email_outbox.delivery_status AS "deliveryStatus",
        email_outbox.payload,
        email_outbox.last_error AS "lastError"
      FROM password_setup_tokens
      CROSS JOIN email_outbox
    `;
    expect(result).toMatchObject({
      revoked: true,
      deliveryStatus: "failed",
      payload: { template: "admin_password_setup" },
      lastError: "Legacy password setup link revoked during security upgrade",
    });
    expect(JSON.stringify(result)).not.toContain(rawToken);
    expect(result!.payload).not.toHaveProperty("setupUrl");
    await expect(
      client`
        INSERT INTO email_outbox (
          dedupe_key, message_type, recipient, locale, payload
        ) VALUES (
          'admin-password-setup:legacy-race',
          'admin_password_setup',
          'owner@example.test',
          'en',
          ${client.json({ setupUrl: "https://example.test/raw" })}
        )
      `,
    ).rejects.toMatchObject({ code: "23514" });
  });
});
