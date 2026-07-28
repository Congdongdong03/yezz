import { bookings, users } from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createAdminRequestReadsRepository } from "./admin-request-reads.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("admin request read receipts PostgreSQL", () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
  });

  afterEach(async () => {
    await database.close();
  });

  it("keeps a request unread for another staff member", async () => {
    const staffA = crypto.randomUUID();
    const staffB = crypto.randomUUID();
    const booking = crypto.randomUUID();
    await database.connection.db.insert(users).values([
      {
        id: staffA,
        email: `${staffA}@example.com`,
        passwordHash: "not-used",
        name: "员工 A",
        role: "staff",
      },
      {
        id: staffB,
        email: `${staffB}@example.com`,
        passwordHash: "not-used",
        name: "员工 B",
        role: "staff",
      },
    ]);
    await database.connection.db.insert(bookings).values({
      id: booking,
      name: "Alice",
      phone: "0430000000",
    });
    const repo = createAdminRequestReadsRepository(database.connection.db);

    await repo.markBookingRead(staffA, booking);

    await expect(repo.isBookingUnread(staffA, booking)).resolves.toBe(false);
    await expect(repo.isBookingUnread(staffB, booking)).resolves.toBe(true);
  });
});
