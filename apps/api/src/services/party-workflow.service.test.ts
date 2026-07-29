import {
  bookingPartyDetails,
  bookingCharges,
  bookings,
  partyPackages,
  studioWeeklyHours,
  users,
} from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createPartyWorkflowService } from "./party-workflow.service.js";
import { createBookingAvailabilityRepository } from "../repositories/booking-availability.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("party workflow PostgreSQL integration", () => {
  let database: RequestFlowTestDatabase;
  let packageId: string;
  let staffId: string;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    packageId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await database.connection.db.insert(users).values({
      id: staffId,
      email: `staff-${staffId}@example.com`,
      passwordHash: "not-used",
      name: "Staff",
    });
    await database.connection.db.insert(studioWeeklyHours).values(
      Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "10:00",
        closesAt: "18:00",
      })),
    );
    await database.connection.db.insert(partyPackages).values({
      id: packageId,
      name: { en: "Ninety-minute party", zh: "九十分钟派对" },
      slug: `party-${packageId}`,
      minPeople: 4,
      maxPeople: 8,
      guestDurationMinutes: 90,
      setupMinutes: 30,
      cleanupMinutes: 30,
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
    });
  });

  afterEach(async () => {
    await database.close();
  });

  function validParty(overrides: Partial<Parameters<ReturnType<typeof createPartyWorkflowService>["createPartyRequest"]>[0]> = {}) {
    return {
      kind: "party" as const,
      partyPackageId: packageId,
      name: "Mei Lin",
      phone: "0430000000",
      email: "mei@example.com",
      birthdayChildName: "Kai",
      birthdayChildAge: 6,
      participantCount: 4,
      parentCount: 1 as const,
      desiredDate: "2030-08-12",
      desiredStartTime: "12:00",
      projectInterests: ["beads"],
      byoCake: true,
      byoDrinks: true,
      byoFood: false,
      byoSnacks: true,
      cakeCuttingRequested: true,
      locale: "en" as const,
      policyVersion: "2026-07-29" as const,
      policyAccepted: true as const,
      ...overrides,
    };
  }

  it.each([
    { participantCount: 3, parentCount: 1 },
    { participantCount: 9, parentCount: 1 },
    { participantCount: 4, parentCount: 0 },
    { participantCount: 4, parentCount: 3 },
  ])("rejects invalid party attendance %#", async (input) => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });

    await expect(service.createPartyRequest(validParty(input as never), crypto.randomUUID()))
      .rejects.toMatchObject({ code: "PARTY_ATTENDANCE_INVALID" });
  });

  it("creates a pending party request without an exclusive hold", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });

    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    const [booking] = await database.connection.db.select().from(bookings).where(eq(bookings.id, created.id));
    const [details] = await database.connection.db.select().from(bookingPartyDetails).where(eq(bookingPartyDetails.bookingId, created.id));

    expect(created).toMatchObject({ status: "pending_review", replayed: false });
    expect(booking).toMatchObject({ status: "pending_review", slotDate: null, slotStartTime: null, slotEndTime: null });
    expect(details).toMatchObject({ desiredDate: "2030-08-12", desiredStartTime: "12:00", venueFeeCents: 9500 });
  });

  it("holds setup through cleanup only after acceptance", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });
    const created = await service.createPartyRequest(validParty({ desiredStartTime: "12:00" }), crypto.randomUUID());
    const interval = { date: "2030-08-12", startTime: "12:00", endTime: "14:30" };
    const availability = createBookingAvailabilityRepository(database.connection.db);

    await service.proposePartyTime({
      bookingId: created.id,
      expectedStatus: "pending_review",
      finalDate: "2030-08-12",
      finalGuestStart: "12:30",
      paymentDeadline: new Date("2030-08-11T00:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    });
    expect(await availability.hasExclusivePartyOverlap(interval)).toBe(false);

    await service.acceptPartyTime({
      bookingId: created.id,
      expectedStatus: "time_proposed",
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    });

    expect(await availability.hasExclusivePartyOverlap(interval)).toBe(true);
  });

  it("records only the configured in-store venue fee once", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    await service.proposePartyTime({
      bookingId: created.id,
      expectedStatus: "pending_review",
      finalDate: "2030-08-12",
      finalGuestStart: "12:00",
      paymentDeadline: new Date("2030-08-11T00:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    });

    await expect(service.recordPartyPayment({
      bookingId: created.id,
      expectedStatus: "awaiting_in_store_payment",
      amountCents: 14500,
      paidAt: new Date("2030-08-10T02:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    })).rejects.toMatchObject({ code: "PARTY_PAYMENT_AMOUNT_INVALID" });

    const paid = await service.recordPartyPayment({
      bookingId: created.id,
      expectedStatus: "awaiting_in_store_payment",
      amountCents: 9500,
      paidAt: new Date("2030-08-10T02:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    });
    expect(paid.status).toBe("confirmed_paid");
    expect(await database.connection.db.select().from(bookingCharges).where(eq(bookingCharges.bookingId, created.id))).toMatchObject([
      { type: "venue_fee", amountCents: 9500 },
    ]);
    await expect(service.recordPartyPayment({
      bookingId: created.id,
      expectedStatus: "awaiting_in_store_payment",
      amountCents: 9500,
      paidAt: new Date("2030-08-10T02:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    })).rejects.toMatchObject({ code: "STATUS_CONFLICT" });
  });
});
