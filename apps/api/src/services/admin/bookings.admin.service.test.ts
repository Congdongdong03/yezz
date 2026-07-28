import {
  bookings,
  diyProjects,
  emailOutbox,
  partyPackages,
  projectCategories,
  requestStatusEvents,
  timeSlots,
  users,
} from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { createAdminBookingsService } from "./bookings.admin.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("admin booking DTO PostgreSQL integration", () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
  });

  afterEach(async () => {
    await database.close();
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
});
