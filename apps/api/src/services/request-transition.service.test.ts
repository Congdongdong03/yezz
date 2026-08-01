import {
  bookings,
  cartOrders,
  customerActionTokens,
  emailOutbox,
  partyPackages,
  requestStatusEvents,
  studioClosures,
  studioWeeklyHours,
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
import { createAdminSettingsService } from "./admin/settings.admin.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";
const ordinaryTestNow = () => new Date("2026-08-01T21:00:00.000Z");

function createTestRequestTransitionService(
  db: Parameters<typeof createRequestTransitionService>[0],
) {
  return createRequestTransitionService(db, { now: ordinaryTestNow });
}

describe("ordinary transition input validation", () => {
  it("rejects party-only external expected status before opening a transaction", async () => {
    await expect(createRequestTransitionService({} as never).transitionOrdinary({
      bookingId: "10000000-0000-4000-8000-000000000001",
      expectedStatus: "awaiting_in_store_payment" as never,
      toStatus: "confirmed",
      operationId: "10000000-0000-4000-8000-000000000002",
      actorUserId: "10000000-0000-4000-8000-000000000003",
    })).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("requires a final date and start time for every ordinary confirmation before opening a transaction", async () => {
    await expect(
      createRequestTransitionService({} as never).transitionOrdinary({
        bookingId: "10000000-0000-4000-8000-000000000001",
        expectedStatus: "pending_review",
        toStatus: "confirmed",
        operationId: "10000000-0000-4000-8000-000000000002",
        actorUserId: "10000000-0000-4000-8000-000000000003",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "newDate and newStartTime are required when confirming an ordinary booking",
    });
  });
});

describe.skipIf(!runDatabaseTests)(
  "request transition PostgreSQL integration",
  () => {
    let database: RequestFlowTestDatabase;
    let actorId: string;
    let partyPackageId: string;
    let slotId: string;
    let previousCustomerActionTokenSecret: string | undefined;
    let previousSiteUrl: string | undefined;

    beforeEach(async () => {
      previousCustomerActionTokenSecret =
        process.env.CUSTOMER_ACTION_TOKEN_SECRET;
      previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.CUSTOMER_ACTION_TOKEN_SECRET =
        "request-transition-test-secret-at-least-32-bytes";
      process.env.NEXT_PUBLIC_SITE_URL = "https://yezyy.com";
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
      if (previousCustomerActionTokenSecret === undefined) {
        delete process.env.CUSTOMER_ACTION_TOKEN_SECRET;
      } else {
        process.env.CUSTOMER_ACTION_TOKEN_SECRET =
          previousCustomerActionTokenSecret;
      }
      if (previousSiteUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
      }
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

    async function markBookingContacted(bookingId: string) {
      await database.connection.db.insert(requestStatusEvents).values({
        bookingId,
        operationId: crypto.randomUUID(),
        fromStatus: "new",
        toStatus: "contacted",
        actorUserId: actorId,
      });
    }

    it("releases capacity once and records one event/email for concurrent cancellation", async () => {
      const booking = await insertBooking("confirmed", "party");
      const first = createTestRequestTransitionService(database.connection.db);
      const second = createTestRequestTransitionService(database.connection.db);

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
      const transition = createTestRequestTransitionService(database.connection.db);
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

    it("does not let a contacted expectation update a merely new booking", async () => {
      const booking = await insertBooking("pending_review");

      await expect(
        createTestRequestTransitionService(database.connection.db).transitionBooking({
          bookingId: booking.id,
          expectedStatus: "contacted",
          status: "confirmed",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
        }),
      ).rejects.toMatchObject({
        code: "STATUS_CONFLICT",
        details: { currentStatus: "new" },
      });
    });

    it("serializes concurrent ordinary confirmations and records one event-bound email", async () => {
      await database.connection.db.insert(studioWeeklyHours).values({
        weekday: 0,
        opensAt: "09:00",
        closesAt: "17:00",
        isClosed: false,
      });
      const [booking] = await database.connection.db.insert(bookings).values({
        name: "Ordinary customer",
        phone: "0430000000",
        email: "ordinary@example.com",
        preferredDate: "2026-08-02",
        numberOfPeople: 2,
        requestKind: "experience",
        slotDate: "2026-08-02",
        slotStartTime: "10:00",
        slotEndTime: "11:00",
        locale: "en",
        status: "pending_review",
        participantCount: 2,
        youngChildCount: 0,
        accompanyingAdultCount: 1,
        attendanceCount: 3,
        durationMinutes: 60,
        policyVersion: "2026-07-29",
        policyAcceptedAt: new Date(),
      }).returning();
      const input = {
        bookingId: booking.id,
        expectedStatus: "pending_review" as const,
        toStatus: "confirmed" as const,
        operationId: crypto.randomUUID(),
        actorUserId: actorId,
        newDate: "2026-08-02",
        newStartTime: "10:00",
      };
      const [first, second] = await Promise.all([
        createTestRequestTransitionService(database.connection.db).transitionOrdinary(input),
        createTestRequestTransitionService(database.connection.db).transitionOrdinary(input),
      ]);
      expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
      const deliveries = await database.connection.db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.bookingId, booking.id));
      const events = await database.connection.db
        .select()
        .from(requestStatusEvents)
        .where(eq(requestStatusEvents.bookingId, booking.id));
      expect(deliveries).toHaveLength(1);
      expect(events).toHaveLength(1);
      expect(deliveries[0]).toMatchObject({
        messageType: "booking_notification_customer",
        statusEventId: events[0]?.id,
        payload: {
          template: "booking_confirmed",
        },
      });
      expect(deliveries[0]?.payload.manageUrl).toMatch(
        /^https:\/\/yezyy\.com\/en\/manage-booking\/[^/]+$/,
      );
      expect(
        await database.connection.db
          .select()
          .from(customerActionTokens)
          .where(eq(customerActionTokens.bookingId, booking.id)),
      ).toHaveLength(1);
    });

    it("rejects confirmation when a partial closure covers the final interval", async () => {
      await database.connection.db.insert(studioWeeklyHours).values({
        weekday: 0,
        opensAt: "09:00",
        closesAt: "17:00",
        isClosed: false,
      });
      await database.connection.db.insert(studioClosures).values({
        date: "2026-08-02",
        startTime: "10:30",
        endTime: "11:30",
      });
      const [booking] = await database.connection.db.insert(bookings).values({
        name: "Closure confirmation customer",
        phone: "0430000007",
        email: "closure@example.com",
        requestKind: "experience",
        status: "pending_review",
        participantCount: 2,
        youngChildCount: 0,
        accompanyingAdultCount: 1,
        attendanceCount: 3,
        durationMinutes: 60,
        slotDate: "2026-08-02",
        slotStartTime: "10:00",
        slotEndTime: "11:00",
        policyVersion: "2026-07-29",
        policyAcceptedAt: new Date(),
      }).returning();

      await expect(
        createTestRequestTransitionService(database.connection.db).transitionOrdinary({
          bookingId: booking!.id,
          expectedStatus: "pending_review",
          toStatus: "confirmed",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
          newDate: "2026-08-02",
          newStartTime: "10:00",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
      });
    });

    it("serializes a partial closure and ordinary confirmation on the operational date", async () => {
      await database.connection.db.insert(studioWeeklyHours).values({
        weekday: 0,
        opensAt: "09:00",
        closesAt: "17:00",
        isClosed: false,
      });
      const [booking] = await database.connection.db.insert(bookings).values({
        name: "Concurrent closure confirmation customer",
        phone: "0430000006",
        email: "closure-race@example.com",
        requestKind: "experience",
        status: "pending_review",
        participantCount: 2,
        youngChildCount: 0,
        accompanyingAdultCount: 1,
        attendanceCount: 3,
        durationMinutes: 60,
        slotDate: "2026-08-02",
        slotStartTime: "10:00",
        slotEndTime: "11:00",
        policyVersion: "2026-07-29",
        policyAcceptedAt: new Date(),
      }).returning();

      const results = await Promise.allSettled([
        createTestRequestTransitionService(database.connection.db).transitionOrdinary({
          bookingId: booking!.id,
          expectedStatus: "pending_review",
          toStatus: "confirmed",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
          newDate: "2026-08-02",
          newStartTime: "10:00",
        }),
        createAdminSettingsService(database.connection.db).createClosure({
          date: "2026-08-02",
          startTime: "10:30",
          endTime: "11:30",
        }),
      ]);

      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(rejected?.reason).toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
      });
    });

    it("serializes a weekly-hours change and ordinary confirmation on their operational date", async () => {
      await database.connection.db.insert(studioWeeklyHours).values(
        Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          opensAt: "10:00",
          closesAt: "18:00",
          isClosed: false,
        })),
      );
      const [booking] = await database.connection.db
        .insert(bookings)
        .values({
          name: "Concurrent weekly-hours confirmation customer",
          phone: "0430000008",
          email: "weekly-hours-race@example.com",
          requestKind: "experience",
          status: "pending_review",
          participantCount: 2,
          youngChildCount: 0,
          accompanyingAdultCount: 1,
          attendanceCount: 3,
          durationMinutes: 60,
          slotDate: "2030-08-12",
          slotStartTime: "17:00",
          slotEndTime: "18:00",
          policyVersion: "2026-07-29",
          policyAcceptedAt: new Date(),
        })
        .returning();
      const now = () => new Date("2030-08-10T00:00:00.000Z");
      const changedDays = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "10:00",
        closesAt: weekday === 1 ? "17:00" : "18:00",
        isClosed: false,
      }));

      const results = await Promise.allSettled([
        createAdminSettingsService(
          database.connection.db,
          null,
          process.env,
          { now },
        ).updateWeekly({ days: changedDays }),
        createRequestTransitionService(database.connection.db, {
          now,
        }).transitionOrdinary({
          bookingId: booking!.id,
          expectedStatus: "pending_review",
          toStatus: "confirmed",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
          newDate: "2030-08-12",
          newStartTime: "17:00",
        }),
      ]);

      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      expect(
        rejected?.reason.code === "SCHEDULE_CONFLICT" ||
          (rejected?.reason.code === "VALIDATION_ERROR" &&
            /closing time/.test(rejected.reason.message)),
      ).toBe(true);
    });

    it("rejects a stale weekly acknowledgement when a concurrent confirmation changes its conflict set", async () => {
      await database.connection.db.insert(studioWeeklyHours).values(
        Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          opensAt: "10:00",
          closesAt: "18:00",
          isClosed: false,
        })),
      );
      const [existingConflict, pendingConfirmation] = await database.connection.db
        .insert(bookings)
        .values([
          {
            name: "Existing schedule conflict",
            phone: "0430000009",
            email: "existing-schedule-conflict@example.com",
            requestKind: "experience",
            status: "confirmed",
            participantCount: 2,
            youngChildCount: 0,
            accompanyingAdultCount: 1,
            attendanceCount: 3,
            durationMinutes: 60,
            slotDate: "2030-08-12",
            slotStartTime: "17:00",
            slotEndTime: "18:00",
            policyVersion: "2026-07-29",
            policyAcceptedAt: new Date(),
          },
          {
            name: "Concurrent acknowledgement confirmation",
            phone: "0430000010",
            email: "concurrent-acknowledgement@example.com",
            requestKind: "experience",
            status: "pending_review",
            participantCount: 2,
            youngChildCount: 0,
            accompanyingAdultCount: 1,
            attendanceCount: 3,
            durationMinutes: 60,
            slotDate: "2030-08-12",
            slotStartTime: "17:00",
            slotEndTime: "18:00",
            policyVersion: "2026-07-29",
            policyAcceptedAt: new Date(),
          },
        ])
        .returning();
      const now = () => new Date("2030-08-10T00:00:00.000Z");
      const changedDays = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "10:00",
        closesAt: weekday === 1 ? "17:00" : "18:00",
        isClosed: false,
      }));
      const scheduleService = createAdminSettingsService(
        database.connection.db,
        null,
        process.env,
        { now },
      );

      let initialConflict: unknown;
      try {
        await scheduleService.updateWeekly({ days: changedDays });
      } catch (caught) {
        initialConflict = caught;
      }
      expect(initialConflict).toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
      });
      const fingerprint = (
        initialConflict as { details?: { conflictFingerprint?: unknown } }
      ).details?.conflictFingerprint;
      expect(fingerprint).toEqual(expect.any(String));

      const results = await Promise.allSettled([
        scheduleService.updateWeekly({
          days: changedDays,
          acknowledgement: { fingerprint: fingerprint as string },
        }),
        createRequestTransitionService(database.connection.db, {
          now,
        }).transitionOrdinary({
          bookingId: pendingConfirmation!.id,
          expectedStatus: "pending_review",
          toStatus: "confirmed",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
          newDate: "2030-08-12",
          newStartTime: "17:00",
        }),
      ]);

      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (rejected?.reason.code === "SCHEDULE_CONFLICT") {
        expect(rejected.reason.details?.conflictFingerprint).not.toBe(fingerprint);
        expect(rejected.reason.details?.affectedBookingNumbers).toEqual(
          expect.arrayContaining([
            expect.any(String),
            expect.any(String),
          ]),
        );
      } else {
        expect(rejected?.reason).toMatchObject({
          code: "VALIDATION_ERROR",
          message: expect.stringMatching(/closing time/),
        });
      }

      await expect(
        database.connection.db
          .select({ status: bookings.status })
          .from(bookings)
          .where(eq(bookings.id, existingConflict!.id)),
      ).resolves.toEqual([{ status: "confirmed" }]);
    });

    it.each([
      ["rejected", "booking_rejected"],
      ["waitlisted", "booking_waitlisted"],
    ] as const)(
      "uses one event-bound lifecycle delivery for an ordinary %s transition",
      async (toStatus, template) => {
        const [booking] = await database.connection.db
          .insert(bookings)
          .values({
            name: "Ordinary lifecycle customer",
            phone: "0430000000",
            email: `${toStatus}@example.com`,
            preferredDate: "2026-08-02",
            numberOfPeople: 2,
            requestKind: "experience",
            slotDate: "2026-08-02",
            slotStartTime: "10:00",
            slotEndTime: "11:00",
            locale: "en",
            status: "pending_review",
            participantCount: 2,
            youngChildCount: 0,
            accompanyingAdultCount: 1,
            attendanceCount: 3,
            durationMinutes: 60,
            policyVersion: "2026-07-29",
            policyAcceptedAt: new Date(),
          })
          .returning();

        const result = await createRequestTransitionService(
          database.connection.db,
        ).transitionOrdinary({
          bookingId: booking.id,
          expectedStatus: "pending_review",
          toStatus,
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
        });

        const deliveries = await database.connection.db
          .select()
          .from(emailOutbox)
          .where(eq(emailOutbox.bookingId, booking.id));
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0]).toMatchObject({
          messageType: "booking_notification_customer",
          statusEventId: result.eventId,
          payload: { template },
        });
        expect(
          await database.connection.db
            .select()
            .from(customerActionTokens)
            .where(eq(customerActionTokens.bookingId, booking.id)),
        ).toHaveLength(1);
      },
    );

    it("replays the same reschedule operation but rejects a changed interval", async () => {
      await database.connection.db.insert(studioWeeklyHours).values([
        { weekday: 0, opensAt: "09:00", closesAt: "17:00", isClosed: false },
        { weekday: 1, opensAt: "09:00", closesAt: "17:00", isClosed: false },
      ]);
      const [booking] = await database.connection.db.insert(bookings).values({
        name: "Reschedule customer", phone: "0430000000", email: "reschedule@example.com",
        preferredDate: "2026-08-02", numberOfPeople: 2, requestKind: "experience",
        slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00", locale: "en",
        status: "reschedule_requested", participantCount: 2, youngChildCount: 0,
        accompanyingAdultCount: 1, attendanceCount: 3, durationMinutes: 60,
        policyVersion: "2026-07-29", policyAcceptedAt: new Date(),
      }).returning();
      const input = {
        bookingId: booking.id, expectedStatus: "reschedule_requested" as const,
        toStatus: "confirmed" as const, operationId: crypto.randomUUID(), actorUserId: actorId,
        newDate: "2026-08-03", newStartTime: "11:00",
      };
      const transition = createTestRequestTransitionService(database.connection.db);
      const first = await transition.transitionOrdinary(input);
      const replay = await transition.transitionOrdinary(input);
      expect([first.replayed, replay.replayed]).toEqual([false, true]);
      await expect(transition.transitionOrdinary({ ...input, newStartTime: "12:00" })).rejects.toMatchObject({ code: "OPERATION_ID_CONFLICT" });
      const [updated] = await database.connection.db.select().from(bookings).where(eq(bookings.id, booking.id));
      expect(updated).toMatchObject({ status: "confirmed", slotDate: "2026-08-03", slotStartTime: "11:00", slotEndTime: "12:00" });
      expect(await database.connection.db.select().from(requestStatusEvents).where(eq(requestStatusEvents.bookingId, booking.id))).toHaveLength(1);
      expect(await database.connection.db.select().from(emailOutbox).where(eq(emailOutbox.bookingId, booking.id))).toHaveLength(1);
    });

    it.each(["capacity", "legacy party overlap", "active party overlap"])("rejects ordinary confirmation on %s", async (conflict) => {
      await database.connection.db.insert(studioWeeklyHours).values({ weekday: 0, opensAt: "09:00", closesAt: "17:00", isClosed: false });
      if (conflict === "capacity") {
        await database.connection.db.insert(bookings).values({
          name: "Occupied", phone: "0430000001", requestKind: "experience", status: "confirmed",
          slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00", attendanceCount: 6,
        });
      } else {
        await database.connection.db.insert(bookings).values({
          name: "Party", phone: "0430000002", requestKind: "party", partyPackageId,
          status: conflict === "active party overlap" ? "awaiting_in_store_payment" : "confirmed", slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00",
        });
      }
      const [ordinary] = await database.connection.db.insert(bookings).values({
        name: "Ordinary", phone: "0430000003", email: "ordinary-conflict@example.com", requestKind: "experience",
        status: "pending_review", slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00",
        participantCount: 2, youngChildCount: 0, accompanyingAdultCount: 1, attendanceCount: 3,
        durationMinutes: 60, policyVersion: "2026-07-29", policyAcceptedAt: new Date(),
      }).returning();
      await expect(createTestRequestTransitionService(database.connection.db).transitionOrdinary({
        bookingId: ordinary.id, expectedStatus: "pending_review", toStatus: "confirmed",
        operationId: crypto.randomUUID(), actorUserId: actorId,
        newDate: "2026-08-02", newStartTime: "10:00",
      })).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    });

    it("rejects waitlist conversion while an active party hold occupies the interval", async () => {
      await database.connection.db.insert(studioWeeklyHours).values({ weekday: 0, opensAt: "09:00", closesAt: "17:00", isClosed: false });
      await database.connection.db.insert(bookings).values({
        name: "Party", phone: "0430000010", requestKind: "party", partyPackageId,
        status: "awaiting_in_store_payment", slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00",
      });
      const [waitlisted] = await database.connection.db.insert(bookings).values({
        name: "Waitlisted", phone: "0430000011", requestKind: "experience", status: "waitlisted",
        slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00", participantCount: 1,
        youngChildCount: 0, accompanyingAdultCount: 0, attendanceCount: 1, durationMinutes: 60,
        policyVersion: "2026-07-29", policyAcceptedAt: new Date(),
      }).returning();
      await expect(createTestRequestTransitionService(database.connection.db).transitionOrdinary({
        bookingId: waitlisted.id, expectedStatus: "waitlisted", toStatus: "confirmed",
        operationId: crypto.randomUUID(), actorUserId: actorId,
        newDate: "2026-08-02", newStartTime: "10:00",
      })).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    });

    it("rejects a stale ordinary expected status before writing an event", async () => {
      const [ordinary] = await database.connection.db.insert(bookings).values({
        name: "Stale", phone: "0430000004", requestKind: "experience", status: "waitlisted",
        slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00",
        participantCount: 2, youngChildCount: 0, accompanyingAdultCount: 1, attendanceCount: 3,
        durationMinutes: 60, policyVersion: "2026-07-29", policyAcceptedAt: new Date(),
      }).returning();
      await expect(createTestRequestTransitionService(database.connection.db).transitionOrdinary({
        bookingId: ordinary.id, expectedStatus: "pending_review", toStatus: "confirmed",
        operationId: crypto.randomUUID(), actorUserId: actorId,
        newDate: "2026-08-02", newStartTime: "10:00",
      })).rejects.toMatchObject({ code: "STATUS_CONFLICT" });
      expect(await database.connection.db.select().from(requestStatusEvents).where(eq(requestStatusEvents.bookingId, ordinary.id))).toHaveLength(0);
    });

    it("does not let a new expectation update a contacted-effective booking", async () => {
      const booking = await insertBooking("pending_review");
      await markBookingContacted(booking.id);

      await expect(
        createTestRequestTransitionService(database.connection.db).transitionBooking({
          bookingId: booking.id,
          expectedStatus: "new",
          status: "confirmed",
          operationId: crypto.randomUUID(),
          actorUserId: actorId,
        }),
      ).rejects.toMatchObject({
        code: "STATUS_CONFLICT",
        details: { currentStatus: "contacted" },
      });
    });

    it("confirms a cart request with one event-bound customer email", async () => {
      const order = await insertCartOrder("new");
      const operationId = crypto.randomUUID();
      const transition = createTestRequestTransitionService(database.connection.db);

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
      const transition = createTestRequestTransitionService(database.connection.db);
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
