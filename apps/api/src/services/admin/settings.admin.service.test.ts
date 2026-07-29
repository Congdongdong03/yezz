import {
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

    it("writes and reads structured weekly, special, and closure rows", async () => {
      const service = createAdminSettingsService(database.connection.db);
      await service.updateWeekly([
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
      ]);
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

      await expect(
        service.createClosure({
          date: "2026-08-01",
          startTime: "12:30",
          endTime: "13:30",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
        details: {
          affectedBookingNumbers: [
            expect.stringMatching(/^booking-\d{8}-[A-F0-9]{4}$/),
          ],
        },
      });

      const closure = await service.createClosure({
        date: "2026-08-01",
        startTime: "12:30",
        endTime: "13:30",
        acknowledgeExistingBookings: true,
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

      await expect(
        service.upsertSpecialHours({
          date: "2026-08-01",
          opensAt: "11:30",
          closesAt: "14:00",
          isClosed: false,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SCHEDULE_CONFLICT",
        details: {
          affectedBookingNumbers: [
            expect.stringMatching(/^booking-\d{8}-[A-F0-9]{4}$/),
            expect.stringMatching(/^booking-\d{8}-[A-F0-9]{4}$/),
          ],
        },
      });

      await expect(
        service.upsertSpecialHours({
          date: "2026-08-01",
          opensAt: "11:30",
          closesAt: "14:00",
          isClosed: false,
          acknowledgeExistingBookings: true,
        }),
      ).resolves.toMatchObject({
        date: "2026-08-01",
        opensAt: "11:30",
        closesAt: "14:00",
      });
    });
  },
);
