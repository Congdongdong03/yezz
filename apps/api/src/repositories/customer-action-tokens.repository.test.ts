import { bookings, customerActionTokens } from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createCustomerActionTokensRepository } from "./customer-action-tokens.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("customer action token repository", () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
  });

  afterEach(async () => {
    await database.close();
  });

  it("finds only an active unexpired digest", async () => {
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Alice",
      phone: "0430000000",
      status: "confirmed",
    });
    await database.connection.db.insert(customerActionTokens).values([
      {
        bookingId,
        tokenDigest: "a".repeat(64),
        scopes: ["request_cancellation"],
        expiresAt: new Date("2030-01-02T00:00:00Z"),
      },
      {
        bookingId,
        tokenDigest: "b".repeat(64),
        scopes: ["request_cancellation"],
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        revokedAt: new Date("2029-12-31T00:00:00Z"),
      },
    ]);
    const repo = createCustomerActionTokensRepository(database.connection.db);

    await expect(
      repo.findActiveByDigest("a".repeat(64), new Date("2030-01-01T00:00:00Z")),
    ).resolves.toMatchObject({ bookingId, tokenDigest: "a".repeat(64) });
    await expect(
      repo.findActiveByDigest("b".repeat(64), new Date("2030-01-01T00:00:00Z")),
    ).resolves.toBeNull();
  });
});
