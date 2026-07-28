import {
  bookings,
  emailOutbox,
  requestStatusEvents,
  timeSlots,
  users,
} from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createRequestTransitionService } from "./request-transition.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "request transition PostgreSQL integration",
  () => {
    let database: RequestFlowTestDatabase;
    let actorId: string;
    let slotId: string;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
      actorId = crypto.randomUUID();
      slotId = crypto.randomUUID();
      await database.connection.db.insert(users).values({
        id: actorId,
        email: "staff@example.com",
        passwordHash: "not-used",
        name: "值班员工",
        role: "staff",
      });
      await database.connection.db.insert(timeSlots).values({
        id: slotId,
        date: "2030-08-12",
        startTime: "10:00",
        endTime: "11:00",
        capacity: 2,
        bookedCount: 2,
      });
    });

    afterEach(async () => {
      await database.close();
    });

    async function insertBooking(status: "new" | "confirmed") {
      const [booking] = await database.connection.db
        .insert(bookings)
        .values({
          name: "Customer",
          phone: "0430000000",
          email: "customer@example.com",
          preferredDate: "2030-08-12",
          numberOfPeople: 2,
          timeSlotId: slotId,
          slotDate: "2030-08-12",
          slotStartTime: "10:00",
          slotEndTime: "11:00",
          locale: "en",
          status,
        })
        .returning();
      return booking;
    }

    it("releases capacity once and records one event/email for concurrent cancellation", async () => {
      const booking = await insertBooking("confirmed");
      const first = createRequestTransitionService(database.connection.db);
      const second = createRequestTransitionService(database.connection.db);

      const outcomes = await Promise.allSettled([
        first.transitionBooking({
          bookingId: booking.id,
          expectedStatus: "confirmed",
          status: "cancelled",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
          note: "Customer cancelled by phone",
        }),
        second.transitionBooking({
          bookingId: booking.id,
          expectedStatus: "confirmed",
          status: "cancelled",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
          note: "Customer cancelled by phone",
        }),
      ]);

      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === "rejected"),
      ).toHaveLength(1);
      const rejected = outcomes.find(
        (outcome) => outcome.status === "rejected",
      );
      expect(
        rejected?.status === "rejected" ? rejected.reason : null,
      ).toMatchObject({
        code: "STATUS_CONFLICT",
        details: { currentStatus: "cancelled" },
      });
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(slot.bookedCount).toBe(0);
      expect(
        await database.connection.db
          .select()
          .from(requestStatusEvents)
          .where(eq(requestStatusEvents.bookingId, booking.id)),
      ).toHaveLength(1);
      expect(
        await database.connection.db
          .select()
          .from(emailOutbox)
          .where(eq(emailOutbox.bookingId, booking.id)),
      ).toHaveLength(1);
    });

    it("replays one operation without changing capacity or enqueueing twice", async () => {
      const booking = await insertBooking("new");
      const operationId = crypto.randomUUID();
      const transition = createRequestTransitionService(database.connection.db);
      const input = {
        bookingId: booking.id,
        expectedStatus: "new" as const,
        status: "confirmed" as const,
        operationId,
        actorUserId: actorId,
        note: "Confirmed by phone",
      };

      const [first, second] = await Promise.all([
        transition.transitionBooking(input),
        transition.transitionBooking(input),
      ]);

      expect([...new Set([first.eventId, second.eventId])]).toHaveLength(1);
      expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(slot.bookedCount).toBe(2);
      expect(
        await database.connection.db
          .select()
          .from(emailOutbox)
          .where(eq(emailOutbox.statusEventId, first.eventId)),
      ).toHaveLength(1);
    });
  },
);
