import {
  cartOrderItems,
  cartOrders,
  emailOutbox,
  requestStatusEvents,
  timeSlots,
  users,
} from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { createAdminCartOrdersService } from "./cart-orders.admin.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "admin cart-order DTO PostgreSQL integration",
  () => {
    let database: RequestFlowTestDatabase;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
    });

    afterEach(async () => {
      await database.close();
    });

    it("returns contact, exact cart schedule, item currency, history, and delivery state", async () => {
      const actorId = crypto.randomUUID();
      const slotId = crypto.randomUUID();
      const orderId = crypto.randomUUID();
      const eventId = crypto.randomUUID();
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
      await database.connection.db.insert(cartOrders).values({
        id: orderId,
        name: "Alice",
        phone: "0430000000",
        email: "alice@example.com",
        numberOfPeople: 2,
        preferredDate: "2030-08-12",
        timeSlotId: slotId,
        slotDate: "2030-08-12",
        slotStartTime: "10:00",
        slotEndTime: "11:00",
        locale: "zh",
        status: "confirmed",
      });
      await database.connection.db.insert(cartOrderItems).values({
        orderId,
        projectName: { en: "Phone case", zh: "手机壳" },
        projectType: "product",
        styleName: { en: "Pink", zh: "粉色" },
        price: "$49",
        priceCurrency: "AUD",
      });
      await database.connection.db.insert(requestStatusEvents).values({
        id: eventId,
        cartOrderId: orderId,
        operationId: crypto.randomUUID(),
        fromStatus: "new",
        toStatus: "confirmed",
        adminNote: "Confirmed by phone",
        actorUserId: actorId,
      });
      await database.connection.db.insert(emailOutbox).values({
        cartOrderId: orderId,
        statusEventId: eventId,
        dedupeKey: `cart-order:${orderId}:status:${eventId}:customer`,
        messageType: "cart_order_status_customer",
        recipient: "alice@example.com",
        locale: "zh",
        payload: {},
        deliveryStatus: "sent",
      });

      await expect(
        createAdminCartOrdersService(database.connection.db).getById(
          orderId,
        ),
      ).resolves.toMatchObject({
        email: "alice@example.com",
        numberOfPeople: 2,
        preferredDate: "2030-08-12",
        locale: "zh",
        slot: {
          id: slotId,
          date: "2030-08-12",
          startTime: "10:00",
          endTime: "11:00",
          timeZone: "Australia/Melbourne",
        },
        items: [
          {
            projectName: { en: "Phone case", zh: "手机壳" },
            styleName: { en: "Pink", zh: "粉色" },
            price: "$49",
            priceCurrency: "AUD",
          },
        ],
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
  },
);
