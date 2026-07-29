import {
  bookings,
  customerActionTokens,
  diyProjects,
  emailOutbox,
  partyPackages,
  projectCategories,
  bookingItems,
  requestStatusEvents,
  siteSettings,
  studioWeeklyHours,
  timeSlots,
} from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../lib/errors.js";
import { createTimeSlotsRepository } from "../repositories/time-slots.repository.js";
import { createBookingAvailabilityRepository } from "../repositories/booking-availability.repository.js";
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

const enabledCapabilities = {
  experience: true,
  product: true,
  party: true,
} as const;

function createEnabledBookingsService(
  db: Parameters<typeof createBookingsService>[0],
) {
  return createBookingsService(db, enabledCapabilities, {
    customerActionTokenSecret:
      "bookings-service-test-customer-action-secret",
    customerManageBaseUrl: "https://yezyy.com",
  });
}

describe("createBookingsService", () => {
  it.each([
    ["experience", { experience: false, product: true, party: true }],
    ["party", { experience: true, product: true, party: false }],
  ] as const)("rejects a disabled %s request before database work", async (kind, capabilities) => {
    const service = createBookingsService({} as never, capabilities);
    const input =
      kind === "experience"
        ? {
            kind: "experience" as const,
            name: "Capability test",
            phone: "0430000000",
            email: "capability@closure.test",
            numberOfPeople: 2,
            projectId: "10000000-0000-4000-8000-000000000001",
            timeSlotId: "10000000-0000-4000-8000-000000000003",
          }
        : {
            kind: "party" as const,
            name: "Capability test",
            phone: "0430000000",
            email: "capability@closure.test",
            numberOfPeople: 2,
            partyPackageId: "10000000-0000-4000-8000-000000000002",
            timeSlotId: "10000000-0000-4000-8000-000000000003",
          };

    await expect(
      service.create(
        input,
        "10000000-0000-4000-8000-000000000004",
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "REQUEST_FLOW_DISABLED",
    });
  });

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
    const service = createEnabledBookingsService({} as never);
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
    const service = createEnabledBookingsService({} as never);
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
    let partyPackageId: string;
    let slotId: string;
    let partySlotId: string;
    let categoryId: string;
    const previousOwnerEmail = process.env.OWNER_EMAIL;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
      process.env.OWNER_EMAIL = "owner@example.com";
      categoryId = crypto.randomUUID();
      projectId = crypto.randomUUID();
      partyPackageId = crypto.randomUUID();
      slotId = crypto.randomUUID();
      partySlotId = crypto.randomUUID();
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
      await database.connection.db.insert(partyPackages).values({
        id: partyPackageId,
        name: { en: "Studio Party Test Package", zh: "工作室派对测试套餐" },
        slug: `studio-party-${partyPackageId}`,
        minPeople: 4,
        maxPeople: 12,
        priceIndicator: "A$ test fixture",
      });
      await database.connection.db.insert(timeSlots).values({
        id: slotId,
        date: "2030-08-12",
        startTime: "10:00",
        endTime: "11:00",
        capacity: 4,
        categoryId,
      });
      await database.connection.db.insert(timeSlots).values({
        id: partySlotId,
        date: "2030-08-12",
        startTime: "12:00",
        endTime: "13:30",
        capacity: 12,
        categoryId: null,
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

    function validParty(
      overrides: Partial<{
        partyPackageId: string;
        timeSlotId: string;
        preferredDate: string;
        numberOfPeople: number;
        email: string;
      }> = {},
    ) {
      return {
        kind: "party" as const,
        partyPackageId,
        timeSlotId: partySlotId,
        preferredDate: "2030-08-12",
        numberOfPeople: 8,
        name: "Mei",
        phone: "0430000001",
        email: "mei@example.com",
        locale: "zh",
        interestedProject: "Spoofed package label",
        ...overrides,
      };
    }

    it("derives immutable project/slot snapshots and queues both acknowledgements once", async () => {
      const service = createEnabledBookingsService(database.connection.db);
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
      const service = createEnabledBookingsService(database.connection.db);
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
      const service = createEnabledBookingsService(database.connection.db);
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
      const first = createEnabledBookingsService(database.connection.db);
      const second = createEnabledBookingsService(database.connection.db);
      await database.connection.db
        .update(timeSlots)
        .set({ capacity: 2 })
        .where(eq(timeSlots.id, slotId));

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

    it("rejects a different payload that reuses a committed idempotency key", async () => {
      const idempotencyKey = crypto.randomUUID();
      const service = createEnabledBookingsService(database.connection.db);
      const created = await service.create(validExperience(), idempotencyKey);

      await expect(
        service.create(
          {
            ...validExperience(),
            email: "other@example.com",
          },
          idempotencyKey,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_CONFLICT",
      });

      const [stored] = await database.connection.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, created.id));
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(stored.email).toBe("alice@example.com");
      expect(slot.bookedCount).toBe(2);
      expect(await database.connection.db.select().from(bookings)).toHaveLength(
        1,
      );
      expect(
        await database.connection.db.select().from(emailOutbox),
      ).toHaveLength(2);
    });

    it("lets one concurrent payload own an idempotency key and rejects the other", async () => {
      const idempotencyKey = crypto.randomUUID();
      const first = createEnabledBookingsService(database.connection.db);
      const second = createEnabledBookingsService(database.connection.db);

      const results = await Promise.allSettled([
        first.create(validExperience(), idempotencyKey),
        second.create(
          {
            ...validExperience(),
            email: "other@example.com",
          },
          idempotencyKey,
        ),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result) => result.status === "rejected",
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        reason: {
          statusCode: 409,
          code: "IDEMPOTENCY_KEY_CONFLICT",
        },
      });
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

    it.each([3, 13])(
      "rejects party people outside the authoritative package range: %s",
      async (numberOfPeople) => {
        const service = createEnabledBookingsService(database.connection.db);

        await expect(
          service.create(
            validParty({ numberOfPeople }),
            crypto.randomUUID(),
          ),
        ).rejects.toMatchObject({
          statusCode: 422,
          code: "PARTY_SIZE_INVALID",
        });

        const [slot] = await database.connection.db
          .select()
          .from(timeSlots)
          .where(eq(timeSlots.id, partySlotId));
        expect(slot.bookedCount).toBe(0);
        expect(
          await database.connection.db.select().from(bookings),
        ).toHaveLength(0);
        expect(
          await database.connection.db.select().from(emailOutbox),
        ).toHaveLength(0);
      },
    );

    it("derives immutable party/slot snapshots and queues both acknowledgements once", async () => {
      const service = createEnabledBookingsService(database.connection.db);
      const idempotencyKey = crypto.randomUUID();

      const created = await service.create(validParty(), idempotencyKey);
      const replayed = await service.create(validParty(), idempotencyKey);
      const [stored] = await database.connection.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, created.id));
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, partySlotId));
      const deliveries = await database.connection.db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.bookingId, created.id));

      expect(replayed).toMatchObject({ id: created.id, replayed: true });
      expect(stored).toMatchObject({
        requestKind: "party",
        projectId: null,
        partyPackageId,
        preferredDate: "2030-08-12",
        numberOfPeople: 8,
        offeringNameSnapshot: {
          en: "Studio Party Test Package",
          zh: "工作室派对测试套餐",
        },
        offeringPriceSnapshot: "A$ test fixture",
        slotDate: "2030-08-12",
        slotStartTime: "12:00",
        slotEndTime: "13:30",
        slotTimezone: "Australia/Melbourne",
        idempotencyKey,
      });
      expect(stored.interestedProject).toBe("Spoofed package label");
      expect(slot.bookedCount).toBe(8);
      expect(deliveries).toHaveLength(2);
      expect(deliveries.map(({ messageType }) => messageType).sort()).toEqual([
        "booking_received_customer",
        "booking_received_owner",
      ]);
      const ownerDelivery = deliveries.find(
        ({ messageType }) => messageType === "booking_received_owner",
      );
      expect(ownerDelivery?.payload).toMatchObject({
        template: "owner_request",
        subject: expect.stringContaining("party"),
        fields: expect.arrayContaining([
          { label: "Party package", value: "工作室派对测试套餐" },
          { label: "Payment", value: "Pay in store" },
        ]),
      });
    });

    it("rejects a category-specific experience slot for a party and rolls back", async () => {
      const service = createEnabledBookingsService(database.connection.db);

      await expect(
        service.create(
          validParty({ timeSlotId: slotId, numberOfPeople: 4 }),
          crypto.randomUUID(),
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: "SLOT_PARTY_MISMATCH",
      });

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

    it("serializes concurrent party replay and reserves capacity once", async () => {
      const idempotencyKey = crypto.randomUUID();
      const first = createEnabledBookingsService(database.connection.db);
      const second = createEnabledBookingsService(database.connection.db);

      const results = await Promise.all([
        first.create(validParty(), idempotencyKey),
        second.create(validParty(), idempotencyKey),
      ]);

      expect([...new Set(results.map(({ id }) => id))]).toHaveLength(1);
      expect(results.map(({ replayed }) => replayed).sort()).toEqual([
        false,
        true,
      ]);
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, partySlotId));
      expect(slot.bookedCount).toBe(8);
      expect(await database.connection.db.select().from(bookings)).toHaveLength(
        1,
      );
      expect(
        await database.connection.db.select().from(emailOutbox),
      ).toHaveLength(2);
    });

    it("rejects a missing party package without reserving capacity", async () => {
      const service = createEnabledBookingsService(database.connection.db);

      await expect(
        service.create(
          validParty({ partyPackageId: crypto.randomUUID() }),
          crypto.randomUUID(),
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PARTY_PACKAGE_NOT_FOUND",
      });

      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, partySlotId));
      expect(slot.bookedCount).toBe(0);
    });

    it("lists only uncategorized slots for the party calendar scope", async () => {
      const rows = await createTimeSlotsRepository(
        database.connection.db,
      ).findByDate("2030-08-12", null);

      expect(rows.map(({ id }) => id)).toEqual([partySlotId]);
    });
  },
);

describe.skipIf(!runDatabaseTests)("ordinary DIY booking PostgreSQL integration", () => {
  let database: RequestFlowTestDatabase;
  let projectId: string;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    const categoryId = crypto.randomUUID();
    projectId = crypto.randomUUID();
    await database.connection.db.insert(projectCategories).values({ id: categoryId, name: { en: "DIY", zh: "手作" }, slug: `diy-${categoryId}` });
    await database.connection.db.insert(diyProjects).values({ id: projectId, categoryId, name: { en: "Clay cup", zh: "陶杯" }, slug: `clay-${projectId}`, projectType: "experience", bookable: true, durationMinutes: 60, priceMin: 4300 });
    await database.connection.db.insert(siteSettings).values({ storeName: "YezYY", experienceRequestsEnabled: true });
    await database.connection.db.insert(studioWeeklyHours).values({ weekday: 0, opensAt: "09:00", closesAt: "17:00", isClosed: false });
  });

  afterEach(async () => database.close());

  function ordinaryInput(overrides: Record<string, unknown> = {}) {
    return {
      kind: "experience" as const, mode: "booking" as const, name: "Customer", email: "customer@example.com", phone: "0430000000",
      date: "2026-08-02", startTime: "10:00", participantCount: 2, youngChildCount: 1, accompanyingAdultCount: 1,
      items: [{ projectId, quantity: 2 }], locale: "en" as const, policyVersion: "2026-07-29" as const, policyAccepted: true as const,
      ...overrides,
    };
  }

  it("creates a pending request without reserving capacity", async () => {
    const service = createEnabledBookingsService(database.connection.db);
    const result = await service.createOrdinaryRequest(ordinaryInput(), crypto.randomUUID());

    expect(result.status).toBe("pending_review");
    const [row] = await database.connection.db.select().from(bookings).where(eq(bookings.id, result.id));
    expect(row.attendanceCount).toBe(3);
    expect(row.slotEndTime).toBe("11:00");
    expect(await database.connection.db.select().from(bookingItems).where(eq(bookingItems.bookingId, result.id))).toMatchObject([
      { projectId, durationMinutesSnapshot: 60, unitPriceCentsSnapshot: 4300, quantity: 2 },
    ]);
    const deliveries = await database.connection.db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.bookingId, result.id));
    expect(deliveries.map(({ payload }) => payload.template).sort()).toEqual([
      "booking_received",
      "staff_notification",
    ]);
  });

  it("rejects an idempotent replay when the database booking gate is disabled", async () => {
    const key = crypto.randomUUID();
    const service = createEnabledBookingsService(database.connection.db);
    await service.createOrdinaryRequest(ordinaryInput(), key);
    await database.connection.db.update(siteSettings).set({ experienceRequestsEnabled: false });

    await expect(service.createOrdinaryRequest(ordinaryInput(), key)).rejects.toMatchObject({
      statusCode: 503,
      code: "REQUEST_FLOW_DISABLED",
    });
  });

  it("replays the original immutable submission after staff confirms it", async () => {
    const key = crypto.randomUUID();
    const service = createEnabledBookingsService(database.connection.db);
    const created = await service.createOrdinaryRequest(ordinaryInput(), key);
    await database.connection.db.update(bookings).set({ status: "confirmed" }).where(eq(bookings.id, created.id));

    await expect(service.createOrdinaryRequest(ordinaryInput(), key)).resolves.toMatchObject({
      id: created.id,
      replayed: true,
    });
    await expect(service.createOrdinaryRequest(ordinaryInput({ phone: "0499999999" }), key)).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_CONFLICT",
    });
  });

  it.each([
    ["quantity mismatch", { items: [{ projectId: "placeholder", quantity: 1 }] }],
    ["missing policy acceptance", { policyAccepted: false }],
    ["after close", { startTime: "16:30" }],
  ])("rejects ordinary creation with %s", async (_label, overrides) => {
    const input = ordinaryInput(overrides);
    if (input.items[0]?.projectId === "placeholder") input.items[0].projectId = projectId;
    await expect(createEnabledBookingsService(database.connection.db).createOrdinaryRequest(input, crypto.randomUUID())).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects a same-day ordinary request less than two Melbourne hours away", async () => {
    await expect(createBookingsService(
      database.connection.db,
      enabledCapabilities,
      { now: () => new Date("2026-08-01T22:01:00.000Z") },
    ).createOrdinaryRequest(
      ordinaryInput({ startTime: "10:00" }),
      crypto.randomUUID(),
    )).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects an unknown or non-bookable project", async () => {
    const service = createEnabledBookingsService(database.connection.db);
    await expect(service.createOrdinaryRequest(ordinaryInput({ items: [{ projectId: crypto.randomUUID(), quantity: 2 }] }), crypto.randomUUID())).rejects.toMatchObject({ code: "PROJECT_NOT_BOOKABLE" });
    await database.connection.db.update(diyProjects).set({ bookable: false }).where(eq(diyProjects.id, projectId));
    await expect(service.createOrdinaryRequest(ordinaryInput(), crypto.randomUUID())).rejects.toMatchObject({ code: "PROJECT_NOT_BOOKABLE" });
  });

  it("starts a waitlisted request without reserving confirmed or legacy capacity", async () => {
    const legacySlotId = crypto.randomUUID();
    await database.connection.db.insert(timeSlots).values({
      id: legacySlotId, date: "2026-08-02", startTime: "10:00", endTime: "11:00", capacity: 8, bookedCount: 2,
    });
    await database.connection.db.insert(bookings).values({
      name: "Already confirmed", phone: "0430000008", requestKind: "experience", status: "confirmed",
      slotDate: "2026-08-02", slotStartTime: "10:00", slotEndTime: "11:00", attendanceCount: 4,
    });
    const availability = createBookingAvailabilityRepository(database.connection.db);
    const interval = { date: "2026-08-02", startTime: "10:00", endTime: "11:00" };
    const beforeAttendance = await availability.sumConfirmedAttendance(interval);
    const [beforeSlot] = await database.connection.db.select().from(timeSlots).where(eq(timeSlots.id, legacySlotId));
    const result = await createEnabledBookingsService(database.connection.db).createOrdinaryRequest(ordinaryInput({ mode: "waitlist" }), crypto.randomUUID());
    const [row] = await database.connection.db.select().from(bookings).where(eq(bookings.id, result.id));
    expect(row.status).toBe("waitlisted");
    expect(row.attendanceCount).toBe(3);
    const deliveries = await database.connection.db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.bookingId, result.id));
    expect(deliveries.map(({ payload }) => payload.template).sort()).toEqual([
      "booking_waitlisted",
      "staff_notification",
    ]);
    const events = await database.connection.db
      .select()
      .from(requestStatusEvents)
      .where(eq(requestStatusEvents.bookingId, result.id));
    expect(events).toMatchObject([
      {
        fromStatus: "pending_review",
        toStatus: "waitlisted",
        actorKind: "system",
        actorUserId: null,
      },
    ]);
    expect(
      deliveries.find(
        ({ payload }) => payload.template === "booking_waitlisted",
      ),
    ).toMatchObject({ statusEventId: events[0]?.id });
    expect(
      await database.connection.db
        .select()
        .from(customerActionTokens)
        .where(eq(customerActionTokens.bookingId, result.id)),
    ).toHaveLength(1);
    expect(await availability.sumConfirmedAttendance(interval)).toBe(beforeAttendance);
    const [afterSlot] = await database.connection.db.select().from(timeSlots).where(eq(timeSlots.id, legacySlotId));
    expect(afterSlot.bookedCount).toBe(beforeSlot.bookedCount);
  });
});

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
      status: "pending_review",
      participantCount: null,
      youngChildCount: null,
      accompanyingAdultCount: null,
      attendanceCount: null,
      durationMinutes: null,
      policyVersion: null,
      policyAcceptedAt: null,
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
