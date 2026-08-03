import {
  bookingCharges,
  bookingItems,
  bookingPartyDetails,
  bookings,
  diyProjects,
  emailOutbox,
  partyPackages,
  projectCategories,
  requestStatusEvents,
  timeSlots,
  users,
} from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import {
  createAdminBookingsService,
  displayBookingEventStatus,
  validateBookingCalendarRange,
} from "./bookings.admin.service.js";

describe("admin booking status display", () => {
  it.each([
    "time_proposed",
    "awaiting_in_store_payment",
    "confirmed_paid",
    "payment_expired",
    "refunded",
    "waitlisted",
    "reschedule_requested",
  ] as const)("preserves the live status %s in history", (status) => {
    expect(displayBookingEventStatus(status)).toBe(status);
  });

  it("accepts at most seven inclusive calendar days", () => {
    expect(validateBookingCalendarRange("2026-07-30", "2026-08-05")).toEqual({
      from: "2026-07-30",
      to: "2026-08-05",
    });
    expect(() =>
      validateBookingCalendarRange("2026-07-30", "2026-08-06"),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "admin booking DTO PostgreSQL integration",
  () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
  });

  afterEach(async () => {
    await database.close();
  });

  it("accepts the current toStatus field when transitioning a legacy booking", async () => {
    const actorUserId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(users).values({
      id: actorUserId,
      email: "legacy-staff@example.com",
      passwordHash: "not-used",
      name: "Legacy staff",
      role: "staff",
    });
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Legacy customer",
      phone: "0430000011",
      email: "legacy@example.com",
      preferredDate: "2030-08-13",
      status: "pending_review",
    });

    await expect(
      createAdminBookingsService(database.connection.db).updateStatus(
        bookingId,
        {
          expectedStatus: "new",
          toStatus: "confirmed",
          operationId: crypto.randomUUID(),
        },
        actorUserId,
      ),
    ).resolves.toMatchObject({ id: bookingId, status: "confirmed" });
  });

  it("requires staff to record customer contact before converting a waitlist request", async () => {
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Waitlisted customer",
      phone: "0430000099",
      requestKind: "experience",
      status: "waitlisted",
      participantCount: 1,
      attendanceCount: 1,
      durationMinutes: 60,
      slotDate: "2030-08-13",
      slotStartTime: "10:00",
      slotEndTime: "11:00",
    });

    await expect(
      createAdminBookingsService(database.connection.db).updateStatus(
        bookingId,
        {
          expectedStatus: "waitlisted",
          toStatus: "confirmed",
          operationId: crypto.randomUUID(),
          contactedCustomer: false,
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "WAITLIST_CONTACT_REQUIRED" });
  });

  it("rejects cancellation denial through the generic admin party transition", async () => {
    const actorUserId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    await database.connection.db.insert(users).values({
      id: actorUserId,
      email: "party-resolution-staff@example.com",
      passwordHash: "not-used",
      name: "Party resolution staff",
      role: "staff",
    });
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Party customer",
      phone: "0430000066",
      email: "party-resolution@example.com",
      requestKind: "party",
      status: "cancellation_requested",
    });

    await expect(
      createAdminBookingsService(database.connection.db).updateStatus(
        bookingId,
        {
          expectedStatus: "cancellation_requested",
          toStatus: "confirmed_paid",
          operationId,
        },
        actorUserId,
      ),
    ).rejects.toMatchObject({ code: "PARTY_DEDICATED_ACTION_REQUIRED" });
    await expect(
      database.connection.db
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId)),
    ).resolves.toEqual([{ status: "cancellation_requested" }]);
    await expect(
      database.connection.db
        .select()
        .from(requestStatusEvents)
        .where(eq(requestStatusEvents.operationId, operationId)),
    ).resolves.toHaveLength(0);
  });

  it("renders customer and system history actors from their explicit actor kinds", async () => {
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Alice",
      phone: "0430000088",
      requestKind: "experience",
      status: "cancellation_requested",
      participantCount: 1,
      attendanceCount: 1,
      durationMinutes: 60,
      slotDate: "2030-08-13",
      slotStartTime: "10:00",
      slotEndTime: "11:00",
    });
    await database.connection.db.insert(requestStatusEvents).values([
      {
        bookingId,
        operationId: crypto.randomUUID(),
        fromStatus: "confirmed",
        toStatus: "cancellation_requested",
        actorKind: "customer",
        customerRescheduleRequest: { date: "2030-08-14", startTime: "13:30" },
      },
      {
        bookingId,
        operationId: crypto.randomUUID(),
        fromStatus: "cancellation_requested",
        toStatus: "cancelled",
        actorKind: "system",
      },
    ]);

    await expect(
      createAdminBookingsService(database.connection.db).getById(bookingId),
    ).resolves.toMatchObject({
      statusHistory: [
        {
          actor: { kind: "customer", name: "Customer" },
            customerRescheduleRequest: {
              date: "2030-08-14",
              startTime: "13:30",
            },
        },
        { actor: { kind: "system", name: "System" } },
      ],
    });
  });

  it("hides party operational metadata while retaining a human party transition note", async () => {
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(bookings).values({
        id: bookingId,
        name: "Party customer",
        phone: "0430000077",
        requestKind: "party",
      status: "cancelled",
    });
    await database.connection.db.insert(requestStatusEvents).values([
        {
          bookingId,
          operationId: crypto.randomUUID(),
          fromStatus: "pending_review",
          toStatus: "time_proposed",
          adminNote: JSON.stringify({ partyWorkflow: 1, action: "propose" }),
          actorUserId: null,
          actorKind: "system",
        },
        {
          bookingId,
          operationId: crypto.randomUUID(),
          fromStatus: "cancellation_requested",
          toStatus: "cancelled",
          adminNote: JSON.stringify({
            partyWorkflow: 1,
            action: "transition",
            note: "Customer confirmed cancellation",
          }),
          actorUserId: null,
          actorKind: "staff",
        },
    ]);

      await expect(
        createAdminBookingsService(database.connection.db).getById(bookingId),
      ).resolves.toMatchObject({
        statusHistory: [
        { note: null },
        { note: "Customer confirmed cancellation" },
        ],
      });
  });

  it("returns immutable offering/slot details, history, and delivery state", async () => {
    const actorId = crypto.randomUUID();
    const slotId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const categoryId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    await database.connection.db.insert(users).values({
      id: actorId,
      email: "staff@example.com",
      passwordHash: "not-used",
      name: "值班员工",
      role: "staff",
    });
    await database.connection.db.insert(timeSlots).values({
      id: slotId,
      date: "2030-08-13",
      startTime: "12:00",
      endTime: "13:00",
      capacity: 4,
    });
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
    });
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Alice",
      phone: "0430000000",
      email: "alice@example.com",
      numberOfPeople: 2,
      preferredDate: "2030-08-12",
      timeSlotId: slotId,
      projectId,
      offeringNameSnapshot: { en: "Phone case", zh: "手机壳" },
      offeringPriceSnapshot: "From $43",
      slotDate: "2030-08-12",
      slotStartTime: "10:00",
      slotEndTime: "11:00",
      status: "confirmed",
    });
    await database.connection.db.insert(requestStatusEvents).values({
      id: eventId,
      bookingId,
      operationId: crypto.randomUUID(),
      fromStatus: "new",
      toStatus: "confirmed",
      adminNote: "Confirmed by phone",
      actorUserId: actorId,
    });
    await database.connection.db.insert(emailOutbox).values({
      bookingId,
      statusEventId: eventId,
      dedupeKey: `booking:${bookingId}:status:${eventId}:customer`,
      messageType: "booking_status_customer",
      recipient: "alice@example.com",
      locale: "en",
      payload: {},
      deliveryStatus: "sent",
    });

    await expect(
      createAdminBookingsService(database.connection.db).getById(
        bookingId,
        actorId,
      ),
    ).resolves.toMatchObject({
      preferredDate: "2030-08-12",
      offering: {
        name: { en: "Phone case", zh: "手机壳" },
        price: "From $43",
      },
      slot: {
        id: slotId,
        date: "2030-08-12",
        startTime: "10:00",
        endTime: "11:00",
        timeZone: "Australia/Melbourne",
      },
      notificationSummary: {
        latestStatus: "sent",
        failedCount: 0,
      },
      statusHistory: [
        {
          fromStatus: "new",
          toStatus: "confirmed",
          note: "Confirmed by phone",
          actor: { id: actorId, name: "值班员工" },
        },
      ],
    });
  });

  it("returns exact party kind, package, contact, slot, and delivery state", async () => {
    const packageId = crypto.randomUUID();
    const slotId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(partyPackages).values({
      id: packageId,
      name: { en: "Studio Party Test Package", zh: "工作室派对测试套餐" },
      slug: `studio-party-${packageId}`,
      minPeople: 4,
      maxPeople: 12,
      priceIndicator: "A$ test fixture",
    });
    await database.connection.db.insert(timeSlots).values({
      id: slotId,
      date: "2030-08-13",
      startTime: "12:00",
      endTime: "13:30",
      capacity: 12,
      bookedCount: 8,
    });
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      requestKind: "party",
      partyPackageId: packageId,
      name: "Mei",
      phone: "0430000001",
      email: "mei@example.com",
      numberOfPeople: 8,
      preferredDate: "2030-08-13",
      timeSlotId: slotId,
      offeringNameSnapshot: {
        en: "Studio Party Test Package",
        zh: "工作室派对测试套餐",
      },
      offeringPriceSnapshot: "A$ test fixture",
      slotDate: "2030-08-13",
      slotStartTime: "12:00",
      slotEndTime: "13:30",
      status: "confirmed",
    });
    await database.connection.db.insert(emailOutbox).values({
      bookingId,
      dedupeKey: `booking:${bookingId}:received:customer`,
      messageType: "booking_received_customer",
      recipient: "mei@example.com",
      locale: "zh",
      payload: {},
      deliveryStatus: "pending",
    });

    await expect(
      createAdminBookingsService(database.connection.db).getById(bookingId),
    ).resolves.toMatchObject({
      kind: "party",
      name: "Mei",
      phone: "0430000001",
      email: "mei@example.com",
      numberOfPeople: 8,
      status: "confirmed",
      offering: {
        id: packageId,
        name: {
          en: "Studio Party Test Package",
          zh: "工作室派对测试套餐",
        },
        price: "A$ test fixture",
      },
      slot: {
        id: slotId,
        date: "2030-08-13",
        startTime: "12:00",
        endTime: "13:30",
        timeZone: "Australia/Melbourne",
      },
      notificationSummary: {
        latestStatus: "pending",
        failedCount: 0,
      },
    });
  });

  it("returns an ordinary booking's stored attendance and selected project items for staff review", async () => {
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Ordinary detail customer",
      phone: "0430000031",
      requestKind: "experience",
      status: "pending_review",
      participantCount: 2,
      youngChildCount: 1,
      accompanyingAdultCount: 1,
      attendanceCount: 3,
      durationMinutes: 60,
      slotDate: "2030-08-13",
      slotStartTime: "10:00",
      slotEndTime: "11:00",
    });
    await database.connection.db.insert(bookingItems).values([
      {
        bookingId,
        projectNameSnapshot: { en: "Phone case", zh: "手机壳" },
        unitPriceCentsSnapshot: 4300,
        durationMinutesSnapshot: 40,
        quantity: 2,
        decideInStore: false,
        sortOrder: 0,
      },
      {
        bookingId,
        projectNameSnapshot: null,
        unitPriceCentsSnapshot: null,
        durationMinutesSnapshot: 20,
        quantity: 1,
        decideInStore: true,
        sortOrder: 1,
      },
    ]);

    await expect(
      createAdminBookingsService(database.connection.db).getById(bookingId),
    ).resolves.toMatchObject({
      attendance: {
        participantCount: 2,
        youngChildCount: 1,
        accompanyingAdultCount: 1,
        totalCount: 3,
        durationMinutes: 60,
      },
      ordinaryDetails: {
        items: [
          {
            projectName: { en: "Phone case", zh: "手机壳" },
            unitPriceCents: 4300,
            durationMinutes: 40,
            quantity: 2,
            decideInStore: false,
          },
          {
            projectName: null,
            unitPriceCents: null,
            durationMinutes: 20,
            quantity: 1,
            decideInStore: true,
          },
        ],
      },
      partyDetails: null,
    });
  });

  it("returns stored party requirements, in-store payment, and charge ledger for staff review", async () => {
    const staffId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(users).values({
      id: staffId,
      email: "party-ledger-staff@example.com",
      passwordHash: "not-used",
      name: "收费员工",
      role: "staff",
    });
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "Party detail customer",
      phone: "0430000032",
      requestKind: "party",
      status: "confirmed_paid",
      participantCount: 4,
      attendanceCount: 5,
      numberOfPeople: 5,
    });
    await database.connection.db.insert(bookingPartyDetails).values({
      bookingId,
      birthdayChildName: "Mia",
      birthdayChildAge: 6,
      participantCount: 4,
      parentCount: 1,
      desiredDate: "2030-08-14",
      desiredStartTime: "13:00",
      byoCake: true,
      byoDrinks: true,
      byoFood: false,
      byoSnacks: true,
      cakeCuttingRequested: true,
      specialRequirements: "Nut-free table",
      finalDate: "2030-08-15",
      finalSetupStart: "12:30",
      finalGuestStart: "13:00",
      finalGuestEnd: "14:30",
      finalCleanupEnd: "15:00",
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
      paymentDeadline: new Date("2030-08-10T03:00:00.000Z"),
      paidAt: new Date("2030-08-09T03:00:00.000Z"),
      paidAmountCents: 9500,
    });
    await database.connection.db.insert(bookingCharges).values([
      {
        bookingId,
        type: "venue_fee",
        amountCents: 9500,
        recordedByUserId: staffId,
        createdAt: new Date("2030-08-09T03:00:00.000Z"),
      },
      {
        bookingId,
        type: "cake_cutting",
        amountCents: 1500,
        note: "Birthday cake",
        recordedByUserId: staffId,
        createdAt: new Date("2030-08-09T03:05:00.000Z"),
      },
    ]);

    await expect(
      createAdminBookingsService(database.connection.db).getById(bookingId),
    ).resolves.toMatchObject({
      attendance: {
        participantCount: 4,
        accompanyingAdultCount: 1,
        totalCount: 5,
      },
      ordinaryDetails: null,
      partyDetails: {
        birthdayChildName: "Mia",
        birthdayChildAge: 6,
        participantCount: 4,
        parentCount: 1,
        desiredDate: "2030-08-14",
        desiredStartTime: "13:00",
        byo: { cake: true, drinks: true, food: false, snacks: true },
        cakeCuttingRequested: true,
        specialRequirements: "Nut-free table",
        finalSchedule: {
          date: "2030-08-15",
          setupStart: "12:30",
          guestStart: "13:00",
          guestEnd: "14:30",
          cleanupEnd: "15:00",
        },
        venueFeeCents: 9500,
        minSpendPerPersonCents: 4500,
        paidAmountCents: 9500,
        charges: [
          {
            type: "venue_fee",
            amountCents: 9500,
            recordedBy: { id: staffId, name: "收费员工" },
          },
          {
            type: "cake_cutting",
            amountCents: 1500,
            note: "Birthday cake",
            recordedBy: { id: staffId, name: "收费员工" },
          },
        ],
      },
    });
  });

  it("reads stored legacy and current policy acceptance metadata without rewriting it", async () => {
    const staffId = crypto.randomUUID();
    const legacyBookingId = crypto.randomUUID();
    const currentBookingId = crypto.randomUUID();
    const legacyAcceptedAt = new Date("2026-07-29T01:02:03.000Z");
    const currentAcceptedAt = new Date("2026-07-30T04:05:06.000Z");
    await database.connection.db.insert(users).values({
      id: staffId,
      email: "policy-audit-staff@example.com",
      passwordHash: "not-used",
      name: "Policy audit staff",
      role: "staff",
    });
    await database.connection.db.insert(bookings).values([
      {
        id: legacyBookingId,
        name: "Legacy policy customer",
        phone: "0430000012",
        policyVersion: "2026-07-29",
        policyAcceptedAt: legacyAcceptedAt,
      },
      {
        id: currentBookingId,
        name: "Current policy customer",
        phone: "0430000013",
          policyVersion: "2026-08-03",
        policyAcceptedAt: currentAcceptedAt,
      },
    ]);
    const service = createAdminBookingsService(database.connection.db);

    const [legacy, current, list] = await Promise.all([
      service.getById(legacyBookingId, staffId),
      service.getById(currentBookingId, staffId),
      service.list({ actorUserId: staffId }),
    ]);

    expect(legacy).toMatchObject({
      policyVersion: "2026-07-29",
      policyAcceptedAt: legacyAcceptedAt,
    });
    expect(current).toMatchObject({
        policyVersion: "2026-08-03",
      policyAcceptedAt: currentAcceptedAt,
    });
    expect(
      list.data
        .filter(
          (booking) =>
            booking.id === legacyBookingId || booking.id === currentBookingId,
        )
        .map((booking) => ({
          id: booking.id,
          policyVersion: booking.policyVersion,
          policyAcceptedAt: booking.policyAcceptedAt,
        })),
    ).toEqual(
      expect.arrayContaining([
        {
          id: legacyBookingId,
          policyVersion: "2026-07-29",
          policyAcceptedAt: legacyAcceptedAt,
        },
        {
          id: currentBookingId,
            policyVersion: "2026-08-03",
          policyAcceptedAt: currentAcceptedAt,
        },
      ]),
    );
  });

  it("returns fixed 25-row unresolved-first pages and applies status and search filters", async () => {
    const staffId = crypto.randomUUID();
    await database.connection.db.insert(users).values({
      id: staffId,
      email: "queue-staff@example.com",
      passwordHash: "not-used",
      name: "队列员工",
      role: "staff",
    });
    const rows = Array.from({ length: 31 }, (_, index) => ({
      id: crypto.randomUUID(),
      name: index === 30 ? "Needle Customer" : `Customer ${index}`,
      phone: `0430000${String(index).padStart(3, "0")}`,
      status: (index < 26 ? "pending_review" : "confirmed") as
        | "pending_review"
        | "confirmed",
        createdAt: new Date(
          `2030-08-${String((index % 20) + 1).padStart(2, "0")}T10:00:00.000Z`,
        ),
    }));
    await database.connection.db.insert(bookings).values(rows);
    await database.connection.db.insert(requestStatusEvents).values([
      {
        bookingId: rows[24]!.id,
        operationId: crypto.randomUUID(),
        fromStatus: "new",
        toStatus: "contacted",
        actorUserId: staffId,
      },
      {
        bookingId: rows[25]!.id,
        operationId: crypto.randomUUID(),
        fromStatus: "new",
        toStatus: "contacted",
        actorUserId: staffId,
      },
    ]);
    const service = createAdminBookingsService(database.connection.db);

    const firstPage = await service.list({ actorUserId: staffId });
    const secondPage = await service.list({ actorUserId: staffId, page: 2 });
    const contacted = await service.list({
      actorUserId: staffId,
      status: "contacted",
    });
    const search = await service.list({
      actorUserId: staffId,
      search: "Needle",
    });

    expect(firstPage).toMatchObject({ total: 31, page: 1, limit: 25 });
    expect(firstPage.data).toHaveLength(25);
      expect(
        firstPage.data.every((booking) => booking.status !== "confirmed"),
      ).toBe(true);
    expect(secondPage).toMatchObject({ total: 31, page: 2, limit: 25 });
    expect(secondPage.data).toHaveLength(6);
    expect(contacted).toMatchObject({ total: 2 });
    expect(contacted.data).toHaveLength(2);
      expect(
        contacted.data.every((booking) => booking.status === "contacted"),
      ).toBe(true);
    expect(search).toMatchObject({ total: 1 });
    expect(search.data[0]?.name).toBe("Needle Customer");
  });

  it("does not mark a list read and marks only the opened booking for that staff member", async () => {
    const staffA = crypto.randomUUID();
    const staffB = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    await database.connection.db.insert(users).values([
      {
        id: staffA,
        email: "reader-a@example.com",
        passwordHash: "not-used",
        name: "员工 A",
        role: "staff",
      },
      {
        id: staffB,
        email: "reader-b@example.com",
        passwordHash: "not-used",
        name: "员工 B",
        role: "staff",
      },
    ]);
    await database.connection.db.insert(bookings).values({
      id: bookingId,
      name: "待阅读预约",
      phone: "0430000000",
    });
    const service = createAdminBookingsService(database.connection.db);

      await expect(
        service.list({ actorUserId: staffA }),
      ).resolves.toMatchObject({
      data: [{ id: bookingId, isUnread: true }],
    });
    await service.getById(bookingId, staffA);

      await expect(
        service.list({ actorUserId: staffA }),
      ).resolves.toMatchObject({
      data: [{ id: bookingId, isUnread: false }],
    });
      await expect(
        service.list({ actorUserId: staffB }),
      ).resolves.toMatchObject({
      data: [{ id: bookingId, isUnread: true }],
    });
  });
  },
);
