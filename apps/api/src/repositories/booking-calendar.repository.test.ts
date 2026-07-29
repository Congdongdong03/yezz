import {
  bookingPartyDetails,
  bookings,
  emailOutbox,
  studioClosures,
  studioSpecialHours,
  studioWeeklyHours,
} from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createBookingCalendarRepository } from "./booking-calendar.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("booking calendar PostgreSQL read model", () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    await database.connection.db.insert(studioWeeklyHours).values({
      weekday: 4,
      opensAt: "09:30",
      closesAt: "17:00",
      isClosed: false,
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("reports overlapping confirmed attendance and active party holds", async () => {
    const ordinary = await database.connection.db
      .insert(bookings)
      .values([
        {
        name: "普通预约甲",
        phone: "0400000011",
        requestKind: "experience",
        status: "confirmed",
        attendanceCount: 3,
        participantCount: 2,
        slotDate: "2026-07-30",
        slotStartTime: "09:30",
        slotEndTime: "10:30",
        },
        {
        name: "普通预约乙",
        phone: "0400000012",
        requestKind: "experience",
        status: "confirmed",
        attendanceCount: 3,
        participantCount: 3,
        slotDate: "2026-07-30",
        slotStartTime: "10:00",
        slotEndTime: "11:00",
        },
      ])
      .returning({ id: bookings.id });
    const [party] = await database.connection.db
      .insert(bookings)
      .values({
        name: "派对预约",
        phone: "0400000013",
        requestKind: "party",
        status: "awaiting_in_store_payment",
        attendanceCount: 7,
        participantCount: 6,
        slotDate: "2026-07-30",
        slotStartTime: "13:30",
        slotEndTime: "16:30",
      })
      .returning({ id: bookings.id });
    await database.connection.db.insert(bookingPartyDetails).values({
      bookingId: party!.id,
      birthdayChildName: "测试儿童",
      birthdayChildAge: 8,
      participantCount: 6,
      parentCount: 1,
      desiredDate: "2026-07-30",
      desiredStartTime: "14:00",
      finalDate: "2026-07-30",
      finalSetupStart: "13:30",
      finalGuestStart: "14:00",
      finalGuestEnd: "16:00",
      finalCleanupEnd: "16:30",
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
      paymentDeadline: new Date("2026-07-29T07:00:00.000Z"),
    });
    await database.connection.db.insert(emailOutbox).values({
      bookingId: ordinary[0]!.id,
      dedupeKey: `booking:${ordinary[0]!.id}:calendar:test`,
      messageType: "booking_notification_customer",
      recipient: "calendar-fixture@example.test",
      locale: "zh",
      payload: {},
      deliveryStatus: "failed",
      lastError: "test-only delivery failure",
    });
    await database.connection.db.insert(studioSpecialHours).values({
      date: "2026-07-30",
      opensAt: "09:30",
      closesAt: "17:00",
      isClosed: false,
      note: "测试特别营业",
    });
    await database.connection.db.insert(studioClosures).values({
      date: "2026-07-30",
      startTime: "12:00",
      endTime: "12:30",
      note: "测试清洁",
    });

    const day = await createBookingCalendarRepository(
      database.connection.db,
    ).readDay("2026-07-30");

    expect(day.intervals).toContainEqual(
      expect.objectContaining({
        startTime: "10:00",
        ordinaryAttendance: 6,
        remainingOrdinaryCapacity: 2,
        partyBlocked: false,
      }),
    );
    expect(day.intervals).toContainEqual(
      expect.objectContaining({
        startTime: "14:00",
        partyBlocked: true,
        remainingOrdinaryCapacity: 0,
      }),
    );
    expect(day.partyBlocks).toContainEqual(
      expect.objectContaining({
        bookingId: party!.id,
        setupStart: "13:30",
        guestStart: "14:00",
        guestEnd: "16:00",
        cleanupEnd: "16:30",
        status: "awaiting_in_store_payment",
      }),
    );
    expect(day.paymentDeadlines).toContainEqual(
      expect.objectContaining({ bookingId: party!.id }),
    );
    expect(day.emailFailures).toContainEqual({
      bookingId: ordinary[0]!.id,
      bookingNumber: expect.stringMatching(/^booking-/),
      count: 1,
    });
    expect(day.specialHours).toMatchObject({ note: "测试特别营业" });
    expect(day.closures).toContainEqual(
      expect.objectContaining({
        startTime: "12:00",
        endTime: "12:30",
        note: "测试清洁",
      }),
    );
  });
});
