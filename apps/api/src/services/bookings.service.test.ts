import {
  bookings,
  diyProjects,
  emailOutbox,
  projectCategories,
  timeSlots,
} from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../lib/errors.js";
import {
  createBookingsService,
  buildBookingEmailHtml,
  normalizeBookingInput,
  normalizeBookingPeople,
  reservedPeopleForBooking,
} from "./bookings.service.js";
import { mapBookingRow } from "./admin/bookings.admin.service.js";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";

describe("createBookingsService", () => {
  it("normalizes omitted people to the exact persisted reservation count", () => {
    expect(normalizeBookingPeople(undefined)).toBe(1);
    expect(reservedPeopleForBooking(null, "slot-1")).toBe(1);
  });

  it("renders the normalized reservation count in immediate owner email", () => {
    const normalized = normalizeBookingInput({
      name: "Customer",
      phone: "0430000000",
      timeSlotId: "slot-1",
    });
    expect(normalized.numberOfPeople).toBe(1);
    expect(buildBookingEmailHtml(normalized)).toContain(
      "<strong>People:</strong> 1",
    );
  });

  it("rejects booking without name", async () => {
    const service = createBookingsService({} as never);
    await expect(
      service.create({ name: "  ", phone: "13800138000" }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_ERROR",
    );
  });

  it("rejects invalid email", async () => {
    const service = createBookingsService({} as never);
    await expect(
      service.create({
        name: "Test",
        phone: "13800138000",
        email: "not-an-email",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "experience booking PostgreSQL integration",
  () => {
    let database: RequestFlowTestDatabase;
    let projectId: string;
    let slotId: string;
    let categoryId: string;
    const previousOwnerEmail = process.env.OWNER_EMAIL;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
      process.env.OWNER_EMAIL = "owner@example.com";
      categoryId = crypto.randomUUID();
      projectId = crypto.randomUUID();
      slotId = crypto.randomUUID();
      await database.connection.db.insert(projectCategories).values({
        id: categoryId,
        name: { en: "Experiences", zh: "体验" },
        slug: `experiences-${categoryId}`,
      });
      await database.connection.db.insert(diyProjects).values({
        id: projectId,
        categoryId,
        name: { en: "Phone case", zh: "手机壳" },
        slug: `phone-case-${projectId}`,
        projectType: "experience",
        priceRange: "From $43",
        priceCurrency: "AUD",
      });
      await database.connection.db.insert(timeSlots).values({
        id: slotId,
        date: "2030-08-12",
        startTime: "10:00",
        endTime: "11:00",
        capacity: 4,
        categoryId,
      });
    });

    afterEach(async () => {
      if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
      else process.env.OWNER_EMAIL = previousOwnerEmail;
      await database.close();
    });

    function validExperience(preferredDate = "2030-08-12") {
      return {
        kind: "experience" as const,
        projectId,
        timeSlotId: slotId,
        preferredDate,
        numberOfPeople: 2,
        name: "Alice",
        phone: "0430000000",
        email: "alice@example.com",
        locale: "en",
        interestedProject: "Spoofed display label",
      };
    }

    it("derives immutable project/slot snapshots and queues both acknowledgements once", async () => {
      const service = createBookingsService(database.connection.db);
      const idempotencyKey = crypto.randomUUID();

      const created = await service.create(
        validExperience(),
        idempotencyKey,
      );
      const replayed = await service.create(
        validExperience(),
        idempotencyKey,
      );
      const [stored] = await database.connection.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, created.id));
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      const deliveries = await database.connection.db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.bookingId, created.id));

      expect(created).toMatchObject({
        status: "new",
        replayed: false,
        notification: "queued",
      });
      expect(replayed).toMatchObject({
        id: created.id,
        replayed: true,
      });
      expect(stored).toMatchObject({
        requestKind: "experience",
        projectId,
        preferredDate: "2030-08-12",
        numberOfPeople: 2,
        offeringNameSnapshot: { en: "Phone case", zh: "手机壳" },
        offeringPriceSnapshot: "From $43",
        slotDate: "2030-08-12",
        slotStartTime: "10:00",
        slotEndTime: "11:00",
        slotTimezone: "Australia/Melbourne",
        idempotencyKey,
      });
      expect(stored.interestedProject).toBe("Spoofed display label");
      expect(stored.offeringNameSnapshot).not.toEqual({
        en: "Spoofed display label",
        zh: "Spoofed display label",
      });
      expect(slot.bookedCount).toBe(2);
      expect(deliveries).toHaveLength(2);
      expect(deliveries.map(({ messageType }) => messageType).sort()).toEqual([
        "booking_received_customer",
        "booking_received_owner",
      ]);
    });

    it("replays a committed booking even when owner email configuration later disappears", async () => {
      const service = createBookingsService(database.connection.db);
      const idempotencyKey = crypto.randomUUID();
      const created = await service.create(validExperience(), idempotencyKey);
      delete process.env.OWNER_EMAIL;

      await expect(
        service.create(validExperience(), idempotencyKey),
      ).resolves.toMatchObject({
        id: created.id,
        replayed: true,
      });
    });

    it("rejects a preferred date that disagrees with the authoritative slot and rolls back", async () => {
      const service = createBookingsService(database.connection.db);
      await expect(
        service.create(validExperience("2030-08-13"), crypto.randomUUID()),
      ).rejects.toMatchObject({ code: "DATE_SLOT_MISMATCH" });

      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(slot.bookedCount).toBe(0);
      expect(await database.connection.db.select().from(bookings)).toHaveLength(
        0,
      );
      expect(
        await database.connection.db.select().from(emailOutbox),
      ).toHaveLength(0);
    });

    it("reserves and enqueues once for concurrent creates with one idempotency key", async () => {
      const idempotencyKey = crypto.randomUUID();
      const first = createBookingsService(database.connection.db);
      const second = createBookingsService(database.connection.db);

      const results = await Promise.all([
        first.create(validExperience(), idempotencyKey),
        second.create(validExperience(), idempotencyKey),
      ]);
      expect([...new Set(results.map(({ id }) => id))]).toHaveLength(1);
      expect(results.map(({ replayed }) => replayed).sort()).toEqual([
        false,
        true,
      ]);
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(slot.bookedCount).toBe(2);
      expect(await database.connection.db.select().from(bookings)).toHaveLength(
        1,
      );
      expect(
        await database.connection.db.select().from(emailOutbox),
      ).toHaveLength(2);
    });
  },
);

describe("mapBookingRow", () => {
  it("maps database row to API DTO", () => {
    const now = new Date("2026-06-04T00:00:00.000Z");
    const row: typeof bookings.$inferSelect = {
      id: "id-1",
      name: "Alice",
      phone: "138",
      wechat: null,
      email: null,
      preferredDate: "2026-06-10",
      numberOfPeople: 2,
      activityType: "date",
      interestedProject: null,
      message: null,
      locale: "zh",
      timeSlotId: null,
      requestKind: "experience",
      projectId: null,
      partyPackageId: null,
      offeringNameSnapshot: null,
      offeringPriceSnapshot: null,
      slotDate: null,
      slotStartTime: null,
      slotEndTime: null,
      slotTimezone: "Australia/Melbourne",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      isRead: false,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };

    expect(mapBookingRow(row)).toMatchObject({
      id: "id-1",
      name: "Alice",
      status: "new",
      preferredDate: "2026-06-10",
    });
  });
});
