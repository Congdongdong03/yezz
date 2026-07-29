import {
  bookingPartyDetails,
  bookings,
  siteSettings,
  studioClosures,
  studioSpecialHours,
  studioWeeklyHours,
} from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { formatBookingOrderId } from "../../lib/email.js";
import {
  createAdminSettingsService,
  DEFAULT_YEZYY_SITE_SETTINGS,
  readEffectiveAdminSwitches,
} from "./settings.admin.service.js";

describe("admin settings defaults", () => {
  it("uses the approved YezYY contact email when creating settings", () => {
    expect(DEFAULT_YEZYY_SITE_SETTINGS.email).toBe("congdongdong03@gmail.com");
  });

  it("shows deployment, database, and effective states separately", () => {
    expect(
      readEffectiveAdminSwitches(
        {
          experienceRequestsEnabled: true,
          partyRequestsEnabled: false,
          productRequestsEnabled: true,
        },
        {
          REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
          REQUEST_FLOW_PARTY_ENABLED: "true",
          REQUEST_FLOW_PRODUCT_ENABLED: "true",
        },
      ),
    ).toEqual({
      database: { experience: true, party: false, product: false },
      deploymentHardGate: {
        experience: true,
        party: true,
        product: true,
      },
      effective: { experience: true, party: false, product: false },
    });
  });
});

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "admin schedule PostgreSQL integration",
  () => {
    let database: RequestFlowTestDatabase;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
      await database.connection.db.insert(siteSettings).values({
        storeName: "YezYY",
      });
    });

    afterEach(async () => {
      await database.close();
    });

    async function requireScheduleConflict(
      operation: () => Promise<unknown>,
    ): Promise<string> {
      let error: unknown;
      try {
        await operation();
      } catch (caught) {
        error = caught;
      }

      expect(error).toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
      });
      const fingerprint = (
        error as { details?: { conflictFingerprint?: unknown } }
      ).details?.conflictFingerprint;
      expect(fingerprint).toEqual(expect.any(String));
      return fingerprint as string;
    }

    it("writes and reads structured weekly, special, and closure rows", async () => {
      const service = createAdminSettingsService(database.connection.db);
      await service.updateWeekly({
        days: [
          {
            weekday: 0,
            opensAt: "10:00",
            closesAt: "17:00",
            isClosed: false,
          },
          ...Array.from({ length: 6 }, (_, index) => ({
            weekday: index + 1,
            opensAt: "09:30",
            closesAt: "17:00",
            isClosed: false,
          })),
        ],
      });
      await service.upsertSpecialHours({
        date: "2026-08-01",
        opensAt: "11:00",
        closesAt: "15:00",
        isClosed: false,
        note: "测试特别营业",
      });
      const closure = await service.createClosure({
        date: "2026-08-01",
        startTime: "12:00",
        endTime: "12:30",
        note: "测试清洁",
      });

      const schedule = await service.getSchedule();
      expect(schedule.weekly).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            weekday: 0,
            opensAt: "10:00",
            closesAt: "17:00",
          }),
        ]),
      );
      expect(schedule.specialHours).toMatchObject([
        {
          date: "2026-08-01",
          opensAt: "11:00",
          closesAt: "15:00",
        },
      ]);
      expect(schedule.closures).toMatchObject([
        {
          id: closure.id,
          date: "2026-08-01",
          startTime: "12:00",
          endTime: "12:30",
        },
      ]);

      await service.deleteClosure(closure.id);
      await expect(
        database.connection.db.select().from(studioClosures),
      ).resolves.toHaveLength(0);
      await expect(
        database.connection.db.select().from(studioSpecialHours),
      ).resolves.toHaveLength(1);
      await expect(
        database.connection.db.select().from(studioWeeklyHours),
      ).resolves.toHaveLength(7);
    });

    it("requires an explicit acknowledgement before overlapping confirmed bookings", async () => {
      const [booking] = await database.connection.db
        .insert(bookings)
        .values({
          name: "冲突测试预约",
          phone: "0400000021",
          requestKind: "experience",
          status: "confirmed",
          attendanceCount: 2,
          participantCount: 2,
          slotDate: "2026-08-01",
          slotStartTime: "12:00",
          slotEndTime: "13:00",
        })
        .returning();
      const service = createAdminSettingsService(database.connection.db);

      await expect(
        service.upsertSpecialHours({
          date: "2026-08-01",
          isClosed: true,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
      });

      const closureFingerprint = await requireScheduleConflict(() =>
        service.createClosure({
          date: "2026-08-01",
          startTime: "12:30",
          endTime: "13:30",
        }),
      );

      const closure = await service.createClosure({
        date: "2026-08-01",
        startTime: "12:30",
        endTime: "13:30",
        acknowledgement: { fingerprint: closureFingerprint },
      });
      expect(closure.id).toBeTruthy();
      await expect(
        database.connection.db
          .select({ status: bookings.status })
          .from(bookings),
      ).resolves.toEqual([{ status: booking!.status }]);
    });

    it("requires acknowledgement before special hours shorten active ordinary or party bookings", async () => {
      await database.connection.db.insert(bookings).values([
        {
          name: "Ordinary special-hours conflict",
          phone: "0400000022",
          requestKind: "experience",
          status: "confirmed",
          attendanceCount: 2,
          participantCount: 2,
          slotDate: "2026-08-01",
          slotStartTime: "11:00",
          slotEndTime: "12:00",
        },
        {
          name: "Party special-hours conflict",
          phone: "0400000023",
          requestKind: "party",
          status: "awaiting_in_store_payment",
          participantCount: 4,
          attendanceCount: 5,
          slotDate: "2026-08-01",
          slotStartTime: "13:00",
          slotEndTime: "15:00",
        },
      ]);
      const service = createAdminSettingsService(database.connection.db);

      const fingerprint = await requireScheduleConflict(() =>
        service.upsertSpecialHours({
          date: "2026-08-01",
          opensAt: "11:30",
          closesAt: "14:00",
          isClosed: false,
        }),
      );

      await expect(
        service.upsertSpecialHours({
          date: "2026-08-01",
          opensAt: "11:30",
          closesAt: "14:00",
          isClosed: false,
          acknowledgement: { fingerprint },
        }),
      ).resolves.toMatchObject({
        date: "2026-08-01",
        opensAt: "11:30",
        closesAt: "14:00",
      });
    });

    it("keeps unresolved cancellation and reschedule requests in special-hours capacity", async () => {
      const inserted = await database.connection.db
        .insert(bookings)
        .values([
          {
            name: "Ordinary cancellation pending",
            phone: "0400000024",
            requestKind: "experience",
            status: "cancellation_requested",
            attendanceCount: 2,
            participantCount: 2,
            slotDate: "2026-08-01",
            slotStartTime: "12:00",
            slotEndTime: "13:00",
          },
          {
            name: "Ordinary reschedule pending",
            phone: "0400000025",
            requestKind: "experience",
            status: "reschedule_requested",
            attendanceCount: 2,
            participantCount: 2,
            slotDate: "2026-08-01",
            slotStartTime: "12:00",
            slotEndTime: "13:00",
          },
          {
            name: "Party cancellation pending",
            phone: "0400000026",
            requestKind: "party",
            status: "cancellation_requested",
            attendanceCount: 5,
            participantCount: 4,
            slotDate: "2026-08-01",
            slotStartTime: "12:00",
            slotEndTime: "13:00",
          },
          {
            name: "Party reschedule pending",
            phone: "0400000027",
            requestKind: "party",
            status: "reschedule_requested",
            attendanceCount: 5,
            participantCount: 4,
            slotDate: "2026-08-01",
            slotStartTime: "12:00",
            slotEndTime: "13:00",
          },
          {
            name: "Terminal ordinary cancellation",
            phone: "0400000028",
            requestKind: "experience",
            status: "cancelled",
            attendanceCount: 2,
            participantCount: 2,
            slotDate: "2026-08-01",
            slotStartTime: "12:00",
            slotEndTime: "13:00",
          },
          {
            name: "Terminal party payment expiry",
            phone: "0400000029",
            requestKind: "party",
            status: "payment_expired",
            attendanceCount: 5,
            participantCount: 4,
            slotDate: "2026-08-01",
            slotStartTime: "12:00",
            slotEndTime: "13:00",
          },
        ])
        .returning();
      const service = createAdminSettingsService(database.connection.db);

      let error: unknown;
      try {
        await service.upsertSpecialHours({ date: "2026-08-01", isClosed: true });
      } catch (caught) {
        error = caught;
      }

      expect(error).toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
      });
      const affected = (
        error as { details?: { affectedBookingNumbers?: string[] } }
      ).details?.affectedBookingNumbers;
      expect(affected).toEqual(
        expect.arrayContaining(
          inserted.slice(0, 4).map((booking) =>
            formatBookingOrderId(booking.id, booking.createdAt),
          ),
        ),
      );
      expect(affected).toHaveLength(4);
    });

    it("requires a fresh special-hours acknowledgement when its conflict version changes", async () => {
      await database.connection.db.insert(bookings).values({
        name: "Special acknowledgement version",
        phone: "0400000030",
        requestKind: "experience",
        status: "confirmed",
        attendanceCount: 2,
        participantCount: 2,
        slotDate: "2026-08-01",
        slotStartTime: "12:00",
        slotEndTime: "13:00",
      });
      const service = createAdminSettingsService(database.connection.db);
      const firstFingerprint = await requireScheduleConflict(() =>
        service.upsertSpecialHours({
          date: "2026-08-01",
          opensAt: "10:00",
          closesAt: "12:30",
          isClosed: false,
        }),
      );

      const secondFingerprint = await requireScheduleConflict(() =>
        service.upsertSpecialHours({
          date: "2026-08-01",
          opensAt: "10:00",
          closesAt: "12:00",
          isClosed: false,
          acknowledgement: { fingerprint: firstFingerprint },
        }),
      );
      expect(secondFingerprint).not.toBe(firstFingerprint);

      await expect(
        service.upsertSpecialHours({
          date: "2026-08-01",
          opensAt: "10:00",
          closesAt: "12:00",
          isClosed: false,
          acknowledgement: { fingerprint: secondFingerprint },
        }),
      ).resolves.toMatchObject({ closesAt: "12:00" });
    });

    it("checks changed weekly hours over the Melbourne booking horizon without treating party setup or cleanup as public hours", async () => {
      const originalDays = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "10:00",
        closesAt: "18:00",
        isClosed: false,
      }));
      await database.connection.db.insert(studioWeeklyHours).values(originalDays);
      const [ordinary, party, beyondHorizon, specialOverride] =
        await database.connection.db
          .insert(bookings)
          .values([
            {
              name: "Weekly ordinary conflict",
              phone: "0400000031",
              requestKind: "experience",
              status: "cancellation_requested",
              attendanceCount: 2,
              participantCount: 2,
              slotDate: "2030-08-12",
              slotStartTime: "17:00",
              slotEndTime: "18:00",
            },
            {
              name: "Weekly party staff-only boundary",
              phone: "0400000032",
              requestKind: "party",
              status: "reschedule_requested",
              participantCount: 4,
              attendanceCount: 5,
              slotDate: "2030-08-13",
              slotStartTime: "12:00",
              slotEndTime: "14:30",
            },
            {
              name: "Outside authoritative horizon",
              phone: "0400000033",
              requestKind: "experience",
              status: "confirmed",
              attendanceCount: 2,
              participantCount: 2,
              slotDate: "2030-08-19",
              slotStartTime: "17:00",
              slotEndTime: "18:00",
            },
            {
              name: "Dated special-hours override",
              phone: "0400000034",
              requestKind: "experience",
              status: "confirmed",
              attendanceCount: 2,
              participantCount: 2,
              slotDate: "2030-08-14",
              slotStartTime: "17:00",
              slotEndTime: "18:00",
            },
          ])
          .returning();
      await database.connection.db.insert(bookingPartyDetails).values({
        bookingId: party!.id,
        birthdayChildName: "Kai",
        birthdayChildAge: 6,
        participantCount: 4,
        parentCount: 1,
        desiredDate: "2030-08-13",
        desiredStartTime: "12:30",
        finalDate: "2030-08-13",
        finalSetupStart: "12:00",
        finalGuestStart: "12:30",
        finalGuestEnd: "14:00",
        finalCleanupEnd: "14:30",
        venueFeeCents: 9500,
        minSpendPerPersonCents: 4500,
      });
      await database.connection.db.insert(studioSpecialHours).values({
        date: "2030-08-14",
        opensAt: "10:00",
        closesAt: "18:00",
        isClosed: false,
      });
      const service = createAdminSettingsService(
        database.connection.db,
        null,
        process.env,
        { now: () => new Date("2030-08-10T00:00:00.000Z") },
      );
      const changedDays = originalDays.map((day) =>
        day.weekday === 1
          ? { ...day, closesAt: "17:00" }
          : day.weekday === 2
            ? { ...day, opensAt: "12:30", closesAt: "14:00" }
            : day.weekday === 3
              ? { ...day, closesAt: "17:00" }
              : day,
      );

      const fingerprint = await requireScheduleConflict(() =>
        service.updateWeekly({ days: changedDays }),
      );

      await expect(
        service.updateWeekly({
          days: changedDays,
          acknowledgement: { fingerprint },
        }),
      ).resolves.toEqual({ weekly: changedDays });
      await expect(
        database.connection.db
          .select({ id: bookings.id, status: bookings.status })
          .from(bookings),
      ).resolves.toEqual(
        expect.arrayContaining(
          [ordinary, party, beyondHorizon, specialOverride].map((booking) => ({
            id: booking!.id,
            status: booking!.status,
          })),
        ),
      );
    });

    it("locks every newly evaluated Melbourne horizon date after midnight rollover", async () => {
      const originalDays = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "10:00",
        closesAt: "18:00",
        isClosed: false,
      }));
      await database.connection.db.insert(studioWeeklyHours).values(originalDays);
      const [booking] = await database.connection.db
        .insert(bookings)
        .values({
          name: "Midnight rollover horizon booking",
          phone: "0400000035",
          requestKind: "experience",
          status: "confirmed",
          attendanceCount: 2,
          participantCount: 2,
          slotDate: "2030-08-18",
          slotStartTime: "17:00",
          slotEndTime: "18:00",
        })
        .returning();
      let reads = 0;
      const service = createAdminSettingsService(
        database.connection.db,
        null,
        process.env,
        {
          now: () =>
            reads++ === 0
              ? new Date("2030-08-10T13:59:59.000Z")
              : new Date("2030-08-10T14:00:00.000Z"),
        },
      );
      const changedDays = originalDays.map((day) =>
        day.weekday === 0 ? { ...day, closesAt: "17:00" } : day,
      );

      let error: unknown;
      try {
        await service.updateWeekly({ days: changedDays });
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
        details: {
          affectedBookingNumbers: [
            formatBookingOrderId(booking!.id, booking!.createdAt),
          ],
        },
      });
    });
  },
);
