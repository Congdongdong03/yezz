import { adminRequestReads, bookings, cartOrders, emailOutbox, users } from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { createNotificationsAdminService } from "./notifications.admin.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("admin queue summary PostgreSQL", () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
  });

  afterEach(async () => {
    await database.close();
  });

  it("counts per-staff unseen, overdue new requests, Melbourne-day confirmations, and failed email", async () => {
    const staffId = crypto.randomUUID();
    const readBookingId = crypto.randomUUID();
    const unseenBookingId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const now = new Date("2030-01-15T02:30:00.000Z");
    await database.connection.db.insert(users).values({
      id: staffId,
      email: "summary-staff@example.com",
      passwordHash: "not-used",
      name: "队列员工",
      role: "staff",
    });
    await database.connection.db.insert(bookings).values([
      {
        id: readBookingId,
        name: "已读超时预约",
        phone: "0430000000",
        status: "new",
        createdAt: new Date("2030-01-14T23:00:00.000Z"),
        updatedAt: new Date("2030-01-14T23:00:00.000Z"),
      },
      {
        id: unseenBookingId,
        name: "今天确认预约",
        phone: "0430000001",
        status: "confirmed",
        createdAt: new Date("2030-01-14T23:30:00.000Z"),
        updatedAt: new Date("2030-01-15T01:00:00.000Z"),
      },
    ]);
    await database.connection.db.insert(cartOrders).values({
      id: orderId,
      name: "已联系订单",
      phone: "0430000002",
      status: "contacted",
      createdAt: new Date("2030-01-15T00:00:00.000Z"),
    });
    await database.connection.db.insert(adminRequestReads).values({
      userId: staffId,
      bookingId: readBookingId,
    });
    await database.connection.db.insert(emailOutbox).values({
      bookingId: unseenBookingId,
      dedupeKey: `failed:${unseenBookingId}`,
      messageType: "booking_received_customer",
      recipient: "customer@example.com",
      locale: "zh",
      payload: {},
      deliveryStatus: "failed",
    });

    await expect(
      createNotificationsAdminService(database.connection.db, { now: () => now }).summary(
        staffId,
      ),
    ).resolves.toEqual({
      unseen: { bookings: 1, orders: 1, total: 2 },
      new: 1,
      contacted: 1,
      overdue: 1,
      confirmedToday: 1,
      emailFailures: 1,
    });
  });
});
