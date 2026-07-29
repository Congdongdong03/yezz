import { bookings, customerActionTokens, emailOutbox, requestStatusEvents } from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createCustomerActionTokensRepository } from "../repositories/customer-action-tokens.repository.js";
import { createCustomerActionsService } from "./customer-actions.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("customer actions", () => {
  let database: RequestFlowTestDatabase;
  let service: ReturnType<typeof createCustomerActionsService>;
  let bookingId: string;
  let currentTime: Date;

  beforeEach(async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    database = await createRequestFlowTestDatabase();
    currentTime = new Date("2030-07-30T00:00:00Z");
    bookingId = crypto.randomUUID();
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Alice",
      phone: "0430000000",
      email: "alice@example.com",
      requestKind: "experience",
      status: "confirmed",
      locale: "en",
      offeringNameSnapshot: { en: "Phone case", zh: "手机壳" },
      slotDate: "2030-08-13",
      slotStartTime: "10:00",
      slotEndTime: "11:00",
      participantCount: 2,
      attendanceCount: 2,
      durationMinutes: 60,
    });
    service = createCustomerActionsService(database.connection.db, {
      now: () => currentTime,
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await database.close();
  });

  it("stores only a digest and enforces scope", async () => {
    const raw = await service.issue({
      bookingId,
      scopes: ["request_cancellation"],
      expiresAt: new Date("2030-08-06T00:00:00Z"),
    });
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const repo = createCustomerActionTokensRepository(database.connection.db);
    expect(await repo.findByRawToken(raw)).toBeNull();
    await expect(service.resolve(raw, "accept_time")).rejects.toMatchObject({
      code: "CUSTOMER_ACTION_FORBIDDEN",
    });
  });

  it("rejects expired, revoked, malformed, and cancelled booking links generically", async () => {
    const expired = await service.issue({
      bookingId,
      scopes: ["request_cancellation"],
      expiresAt: new Date("2030-07-31T00:00:00Z"),
    });
    currentTime = new Date("2030-08-01T00:00:00Z");
    const revoked = await service.issue({
      bookingId,
      scopes: ["request_cancellation"],
      expiresAt: new Date("2030-08-06T00:00:00Z"),
    });
    const digest = service.digest(revoked);
    await database.connection.db
      .update(customerActionTokens)
      .set({ revokedAt: new Date("2030-08-01T00:00:00Z") })
      .where(eq(customerActionTokens.tokenDigest, digest));
    for (const token of [expired, revoked, "not-a-token", "x".repeat(43)]) {
      await expect(service.resolve(token, "request_cancellation")).rejects.toMatchObject({
        code: "LINK_INVALID_OR_EXPIRED",
      });
    }
    const active = await service.issue({
      bookingId,
      scopes: ["request_cancellation"],
      expiresAt: new Date("2030-08-06T00:00:00Z"),
    });
    await database.connection.db
      .update(bookings)
      .set({ status: "cancelled" })
      .where(eq(bookings.id, bookingId));
    await expect(service.resolve(active, "request_cancellation")).rejects.toMatchObject({
      code: "LINK_INVALID_OR_EXPIRED",
    });
  });

  it("records a customer cancellation request and owner notification atomically", async () => {
    const raw = await service.issue({
      bookingId,
      scopes: ["request_cancellation"],
      expiresAt: new Date("2030-08-06T00:00:00Z"),
    });

    await expect(service.requestCancellation(raw)).resolves.toMatchObject({
      status: "cancellation_requested",
      allowedActions: [],
    });
    await expect(
      database.connection.db.select().from(requestStatusEvents),
    ).resolves.toMatchObject([
      { fromStatus: "confirmed", toStatus: "cancellation_requested", actorKind: "customer", actorUserId: null },
    ]);
    await expect(database.connection.db.select().from(emailOutbox)).resolves.toMatchObject([
      { recipient: "owner@example.com", messageType: "booking_received_owner" },
    ]);
  });

  it("records a reschedule request without reserving its requested interval", async () => {
    const raw = await service.issue({
      bookingId,
      scopes: ["request_reschedule"],
      expiresAt: new Date("2030-08-06T00:00:00Z"),
    });

    await expect(
      service.requestReschedule(raw, { date: "2030-08-14", startTime: "13:30" }),
    ).resolves.toMatchObject({ status: "reschedule_requested" });
    const [booking] = await database.connection.db.select().from(bookings);
    expect(booking).toMatchObject({
      slotDate: "2030-08-13",
      slotStartTime: "10:00",
      slotEndTime: "11:00",
      status: "reschedule_requested",
    });
    const [event] = await database.connection.db.select().from(requestStatusEvents);
    expect(event?.adminNote).toContain('"date":"2030-08-14"');
    expect(event?.adminNote).toContain('"startTime":"13:30"');
  });
});
