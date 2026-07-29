import { bookingPartyDetails, bookings, requestStatusEvents } from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingMaintenanceRepository } from "../repositories/booking-maintenance.repository.js";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createPartyWorkflowService } from "./party-workflow.service.js";
import {
  createBookingMaintenanceService,
  startBookingMaintenanceWorker,
} from "./booking-maintenance.service.js";

const NOW = new Date("2026-10-03T01:00:00.000Z");

const expired = {
  bookingId: "00000000-0000-4000-8000-000000000001",
  paymentDeadline: new Date("2026-10-03T00:59:00.000Z"),
};

const reminder = {
  bookingId: "00000000-0000-4000-8000-000000000002",
  customerName: "Wesley",
  email: "customer@example.com",
  locale: "en" as const,
  createdAt: new Date("2026-07-29T00:00:00.000Z"),
  offeringLabel: "Melty Bead Craft",
  date: "2026-10-04",
  startTime: "12:00",
  endTime: "13:00",
};

describe("booking maintenance service", () => {
  it("expires overdue party holds before it queues reminders", async () => {
    const order: string[] = [];
    const repository = {
      findExpiredPartyHolds: vi.fn(async () => [expired]),
      findBookingsNeedingReminder: vi.fn(async () => [reminder]),
      markReminderEnqueued: vi.fn(async () => {
        order.push("reminder");
        return true;
      }),
    };
    const partyWorkflow = {
      expirePartyHold: vi.fn(async () => {
        order.push("expiry");
        return { status: "payment_expired" };
      }),
    };
    const service = createBookingMaintenanceService(repository, partyWorkflow, {
      now: () => NOW,
      customerActionTokenSecret: "maintenance-test-secret-at-least-32-bytes",
      customerManageBaseUrl: "https://yezyy.com",
    });

    await expect(service.runOnce()).resolves.toEqual({
      expired: 1,
      remindersEnqueued: 1,
    });
    expect(order).toEqual(["expiry", "reminder"]);
    expect(partyWorkflow.expirePartyHold).toHaveBeenCalledWith({
      bookingId: expired.bookingId,
      expectedStatus: "awaiting_in_store_payment",
      operationId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      actorUserId: null,
    });
    expect(repository.markReminderEnqueued).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: reminder.bookingId,
        manageUrl: expect.stringMatching(
          /^https:\/\/yezyy\.com\/en\/manage-booking\/[A-Za-z0-9_-]{43}$/,
        ),
        tokenDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      NOW,
    );
  });

  it("uses stable expiry operation IDs and reminder credentials across instances", async () => {
    const expiryEffects = new Set<string>();
    const reminderEffects = new Set<string>();
    const operationIds: string[] = [];
    const tokenDigests: string[] = [];
    const repository = {
      findExpiredPartyHolds: vi.fn(async () => [expired]),
      findBookingsNeedingReminder: vi.fn(async () => [reminder]),
      markReminderEnqueued: vi.fn(async (input: { tokenDigest: string }) => {
        tokenDigests.push(input.tokenDigest);
        const before = reminderEffects.size;
        reminderEffects.add(input.tokenDigest);
        return reminderEffects.size > before;
      }),
    };
    const partyWorkflow = {
      expirePartyHold: vi.fn(async (input: { operationId: string }) => {
        operationIds.push(input.operationId);
        expiryEffects.add(input.operationId);
        return { status: "payment_expired" };
      }),
    };
    const options = {
      now: () => NOW,
      customerActionTokenSecret: "maintenance-test-secret-at-least-32-bytes",
      customerManageBaseUrl: "https://yezyy.com",
    };

    const [left, right] = await Promise.all([
      createBookingMaintenanceService(
        repository,
        partyWorkflow,
        options,
      ).runOnce(),
      createBookingMaintenanceService(
        repository,
        partyWorkflow,
        options,
      ).runOnce(),
    ]);

    expect(operationIds[0]).toBe(operationIds[1]);
    expect(tokenDigests[0]).toBe(tokenDigests[1]);
    expect(expiryEffects.size).toBe(1);
    expect(reminderEffects.size).toBe(1);
    expect(left.remindersEnqueued + right.remindersEnqueued).toBe(1);
  });

  it("does not overlap runOnce calls in one service", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const repository = {
      findExpiredPartyHolds: vi.fn(async () => {
        await gate;
        return [];
      }),
      findBookingsNeedingReminder: vi.fn(async () => []),
      markReminderEnqueued: vi.fn(),
    };
    const service = createBookingMaintenanceService(
      repository,
      { expirePartyHold: vi.fn() },
      {
        now: () => NOW,
        customerActionTokenSecret: "maintenance-test-secret-at-least-32-bytes",
        customerManageBaseUrl: "https://yezyy.com",
      },
    );

    const first = service.runOnce();
    const second = service.runOnce();
    release?.();
    await Promise.all([first, second]);

    expect(repository.findExpiredPartyHolds).toHaveBeenCalledTimes(1);
  });

  it("polls immediately and every 60 seconds by default, then stops cleanly", async () => {
    vi.useFakeTimers();
    const runOnce = vi.fn(async () => ({
      expired: 0,
      remindersEnqueued: 0,
    }));
    const stop = startBookingMaintenanceWorker({ runOnce });

    await vi.runAllTicks();
    expect(runOnce).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(runOnce).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(runOnce).toHaveBeenCalledTimes(2);

    await stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runOnce).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("reports only safe diagnostics when a maintenance poll fails", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const stop = startBookingMaintenanceWorker(
      {
        runOnce: vi.fn(async () => {
          throw new Error("customer@example.com secret payload");
        }),
      },
      onError,
      { pollMilliseconds: 50 },
    );

    await vi.runAllTicks();
    expect(onError).toHaveBeenCalledOnce();
    expect(JSON.stringify(onError.mock.calls[0]?.[0])).not.toContain(
      "customer@example.com",
    );
    await stop();
    vi.useRealTimers();
  });
});

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "booking maintenance concurrent PostgreSQL integration",
  () => {
    let database: RequestFlowTestDatabase;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
    });

    afterEach(async () => {
      await database.close();
    });

    it("records one system expiry effect across concurrent API instances", async () => {
      const [booking] = await database.connection.db
        .insert(bookings)
        .values({
          name: "Party Customer",
          phone: "0430787712",
          email: "party@example.com",
          locale: "en",
          requestKind: "party",
          status: "awaiting_in_store_payment",
          slotDate: "2026-10-04",
          slotStartTime: "11:30",
          slotEndTime: "14:00",
        })
        .returning();
      await database.connection.db.insert(bookingPartyDetails).values({
        bookingId: booking!.id,
        birthdayChildName: "Child",
        birthdayChildAge: 8,
        participantCount: 6,
        parentCount: 1,
        desiredDate: "2026-10-04",
        desiredStartTime: "12:00",
        finalDate: "2026-10-04",
        finalSetupStart: "11:30",
        finalGuestStart: "12:00",
        finalGuestEnd: "13:30",
        finalCleanupEnd: "14:00",
        venueFeeCents: 9500,
        minSpendPerPersonCents: 4500,
        paymentDeadline: new Date("2026-10-03T00:59:00.000Z"),
      });
      const now = () => NOW;
      const repository = createBookingMaintenanceRepository(
        database.connection.db,
      );
      const partyWorkflow = createPartyWorkflowService(database.connection.db, {
        now,
      });
      const options = {
        now,
        customerActionTokenSecret: "maintenance-test-secret-at-least-32-bytes",
        customerManageBaseUrl: "https://yezyy.com",
      };

      await Promise.all([
        createBookingMaintenanceService(
          repository,
          partyWorkflow,
          options,
        ).runOnce(),
        createBookingMaintenanceService(
          repository,
          partyWorkflow,
          options,
        ).runOnce(),
      ]);

      const [updated] = await database.connection.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, booking!.id));
      const events = await database.connection.db
        .select()
        .from(requestStatusEvents)
        .where(eq(requestStatusEvents.bookingId, booking!.id));
      expect(updated?.status).toBe("payment_expired");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        actorKind: "system",
        actorUserId: null,
        fromStatus: "awaiting_in_store_payment",
        toStatus: "payment_expired",
      });
    });
  },
);
