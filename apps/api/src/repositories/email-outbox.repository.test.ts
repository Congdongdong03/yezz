import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import { createEmailOutboxRepository } from "./email-outbox.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_REPOSITORY_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/db/migrations/", import.meta.url),
);

function requireSafeTestDatabaseUrl(): string {
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_DB_REPOSITORY_TESTS=1",
    );
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Repository tests refuse TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }
  const databaseName = decodeURIComponent(
    new URL(testDatabaseUrl).pathname.slice(1),
  );
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Repository tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return testDatabaseUrl;
}

let adminClient: Sql | undefined;
const generatedSchemas: string[] = [];

async function applyMigrations(client: Sql, schema: string) {
  for (const name of [
    "0000_ordinary_captain_britain.sql",
    "0001_nice_ezekiel.sql",
    "0002_yezyy_flow_closure.sql",
  ]) {
    const contents = (
      await readFile(`${migrationsDirectory}${name}`, "utf8")
    ).replaceAll('"public".', `"${schema}".`);
    for (const statement of contents
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean)) {
      await client.unsafe(`SET search_path TO "${schema}"`);
      await client.unsafe(statement);
    }
  }
}

async function setupRepository() {
  const url = requireSafeTestDatabaseUrl();
  adminClient = postgres(url, { max: 1 });
  const schema = `yezyy_outbox_test_${crypto.randomUUID().replaceAll("-", "")}`;
  generatedSchemas.push(schema);
  await adminClient.unsafe(`CREATE SCHEMA "${schema}"`);
  await applyMigrations(adminClient, schema);

  const client = postgres(url, {
    max: 4,
    connection: { search_path: schema },
  });
  const db = drizzle(client);
  const [booking] = await client<{ id: string }[]>`
    INSERT INTO bookings (name, phone)
    VALUES ('Queue Customer', '0430000000')
    RETURNING id
  `;
  return {
    bookingId: booking.id,
    client,
    repo: createEmailOutboxRepository(db as never),
  };
}

afterEach(async () => {
  if (!adminClient) return;
  for (const schema of generatedSchemas.splice(0)) {
    await adminClient.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await adminClient.end();
  adminClient = undefined;
});

describe.skipIf(!runDatabaseTests)(
  "email outbox repository PostgreSQL concurrency",
  () => {
    it("deduplicates the same business message", async () => {
      const { bookingId, client, repo } = await setupRepository();
      const message = {
        dedupeKey: "booking:1:received:customer",
        bookingId,
        messageType: "booking_received_customer",
        recipient: "customer@example.test",
        locale: "en",
        payload: { template: "booking_received", customerName: "Customer" },
      };

      const first = await repo.enqueue(message);
      const second = await repo.enqueue(message);

      expect(second.id).toBe(first.id);
      await client.end();
    });

    it("lets concurrent workers claim different rows", async () => {
      const { bookingId, client, repo } = await setupRepository();
      for (const suffix of ["one", "two"]) {
        await repo.enqueue({
          dedupeKey: `booking:1:${suffix}:customer`,
          bookingId,
          messageType: "booking_received_customer",
          recipient: `${suffix}@example.test`,
          locale: "en",
          payload: { template: "booking_received", customerName: suffix },
        });
      }

      const now = new Date("2099-07-28T02:00:00.000Z");
      const [one, two] = await Promise.all([
        repo.claimDue(1, now),
        repo.claimDue(1, now),
      ]);

      expect(one).toHaveLength(1);
      expect(two).toHaveLength(1);
      expect(one[0].id).not.toBe(two[0].id);
      await client.end();
    });

    it("recovers a processing row after its lease expires", async () => {
      const { bookingId, client, repo } = await setupRepository();
      const queued = await repo.enqueue({
        dedupeKey: "booking:1:lease:customer",
        bookingId,
        messageType: "booking_received_customer",
        recipient: "lease@example.test",
        locale: "en",
        payload: { template: "booking_received", customerName: "Lease" },
      });
      const first = await repo.claimDue(
        1,
        new Date("2099-07-28T02:00:00.000Z"),
      );
      expect(first[0].id).toBe(queued.id);

      expect(
        await repo.claimDue(1, new Date("2099-07-28T02:04:59.000Z")),
      ).toHaveLength(0);
      expect(
        await repo.claimDue(1, new Date("2099-07-28T02:05:00.000Z")),
      ).toHaveLength(1);
      await client.end();
    });
  },
);
