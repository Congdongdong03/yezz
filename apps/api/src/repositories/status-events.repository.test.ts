import { bookings, timeSlots, users } from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createStatusEventsRepository } from "./status-events.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "status events PostgreSQL repository",
  () => {
    let database: RequestFlowTestDatabase;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
    });

    afterEach(async () => {
      await database.close();
    });

    it("retrieves an operation globally and returns actor-attributed booking history", async () => {
      const actorId = crypto.randomUUID();
      const slotId = crypto.randomUUID();
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
      });
      const [booking] = await database.connection.db
        .insert(bookings)
        .values({
          name: "Alice",
          phone: "0430000000",
          timeSlotId: slotId,
        })
        .returning();
      const operationId = crypto.randomUUID();
      const repository = createStatusEventsRepository(database.connection.db);
      const created = await repository.createBooking({
        bookingId: booking.id,
        operationId,
        fromStatus: "new",
        toStatus: "contacted",
        adminNote: "Reached by phone",
        actorUserId: actorId,
      });

      await expect(
        repository.findByOperationId(operationId),
      ).resolves.toMatchObject({
        id: created.id,
        bookingId: booking.id,
        operationId,
      });
      await expect(repository.listForBooking(booking.id)).resolves.toEqual([
        expect.objectContaining({
          id: created.id,
          actorId,
          actorName: "值班员工",
          fromStatus: "new",
          toStatus: "contacted",
          note: "Reached by phone",
        }),
      ]);
    });
  },
);
