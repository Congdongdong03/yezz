import {
  bookings,
  cartOrders,
  emailOutbox,
  partyPackages,
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
    let partyPackageId: string;
    let slotId: string;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
      actorId = crypto.randomUUID();
      partyPackageId = crypto.randomUUID();
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
      await database.connection.db.insert(partyPackages).values({
        id: partyPackageId,
        name: { en: "Studio Party Test Package", zh: "工作室派对测试套餐" },
        slug: `studio-party-${partyPackageId}`,
        minPeople: 2,
        maxPeople: 12,
      });
    });

    afterEach(async () => {
      await database.close();
    });

    async function insertBooking(
      status: "pending_review" | "confirmed",
      kind: "experience" | "party" = "experience",
    ) {
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
          requestKind: kind,
          partyPackageId: kind === "party" ? partyPackageId : null,
        })
        .returning();
      return booking;
    }

    async function insertCartOrder(status: "new" | "confirmed") {
      const [order] = await database.connection.db
        .insert(cartOrders)
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
      return order;
    }

    it("releases capacity once and records one event/email for concurrent cancellation", async () => {
      const booking = await insertBooking("confirmed", "party");
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
      const booking = await insertBooking("pending_review");
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

    it("confirms a cart request with one event-bound customer email", async () => {
      const order = await insertCartOrder("new");
      const operationId = crypto.randomUUID();
      const transition = createRequestTransitionService(database.connection.db);

      const result = await transition.transitionCartOrder({
        cartOrderId: order.id,
        expectedStatus: "new",
        status: "confirmed",
        operationId,
        actorUserId: actorId,
        note: "Confirmed by phone",
      });

      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      const events = await database.connection.db
        .select()
        .from(requestStatusEvents)
        .where(eq(requestStatusEvents.cartOrderId, order.id));
      const deliveries = await database.connection.db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.cartOrderId, order.id));

      expect(result).toMatchObject({ replayed: false });
      expect(slot.bookedCount).toBe(2);
      expect(events).toHaveLength(1);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toMatchObject({
        statusEventId: events[0]?.id,
        messageType: "cart_order_status_customer",
        recipient: "customer@example.com",
        payload: {
          template: "booking_status",
          status: "confirmed",
          slotLabel:
            "2030-08-12 10:00–11:00 Australia/Melbourne",
        },
      });
    });

    it("replays one cart cancellation while releasing capacity exactly once", async () => {
      const order = await insertCartOrder("confirmed");
      const operationId = crypto.randomUUID();
      const transition = createRequestTransitionService(database.connection.db);
      const input = {
        cartOrderId: order.id,
        expectedStatus: "confirmed" as const,
        status: "cancelled" as const,
        operationId,
        actorUserId: actorId,
        note: "Customer cancelled by phone",
      };

      const first = await transition.transitionCartOrder(input);
      const replay = await transition.transitionCartOrder(input);

      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(replay).toMatchObject({
        eventId: first.eventId,
        replayed: true,
      });
      expect(slot.bookedCount).toBe(0);
      expect(
        await database.connection.db
          .select()
          .from(requestStatusEvents)
          .where(eq(requestStatusEvents.cartOrderId, order.id)),
      ).toHaveLength(1);
      const deliveries = await database.connection.db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.cartOrderId, order.id));
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toMatchObject({
        messageType: "cart_order_status_customer",
        payload: {
          template: "booking_status",
          status: "cancelled",
        },
      });
    });
  },
);
