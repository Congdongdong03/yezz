import { bookings, createDb, timeSlots } from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequestCapacityRepository } from "./request-capacity.repository.js";
import { createTimeSlotsService } from "../services/time-slots.service.js";
import { createAdminBookingsService } from "../services/admin/bookings.admin.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_SLOT_TESTS === "1";
const configuredTestUrl = process.env.TEST_DATABASE_URL;

function requireSafeTestDatabaseUrl(): string {
  if (!configuredTestUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_DB_SLOT_TESTS=1",
    );
  }
  if (configuredTestUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Slot tests refuse TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }
  const databaseName = decodeURIComponent(
    new URL(configuredTestUrl).pathname.slice(1),
  );
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Slot tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return configuredTestUrl;
}

function withSearchPath(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-csearch_path=${schema}`);
  return parsed.toString();
}

describe.skipIf(!runDatabaseTests)(
  "request capacity PostgreSQL integration",
  () => {
    let schema = "";
    let bootstrap: ReturnType<typeof createDb> | undefined;
    let connection: ReturnType<typeof createDb> | undefined;

    beforeEach(async () => {
      const url = requireSafeTestDatabaseUrl();
      schema = `yezyy_slot_test_${crypto.randomUUID().replaceAll("-", "")}`;
      bootstrap = createDb(url);
      await bootstrap.client.unsafe(`CREATE SCHEMA "${schema}"`);
      await bootstrap.client.unsafe(`
        CREATE TABLE "${schema}".time_slots (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          date date NOT NULL,
          start_time varchar(8) NOT NULL,
          end_time varchar(8) NOT NULL,
          capacity integer NOT NULL CHECK (capacity >= 1),
          booked_count integer NOT NULL DEFAULT 0
            CHECK (booked_count >= 0 AND booked_count <= capacity),
          category_id uuid,
          is_available boolean NOT NULL DEFAULT true,
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await bootstrap.client.unsafe(`
        CREATE TABLE "${schema}".bookings (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name varchar(255) NOT NULL, phone varchar(64) NOT NULL,
          wechat varchar(128), email varchar(255), preferred_date date,
          number_of_people integer, activity_type varchar(32),
          interested_project varchar(255), message text, locale varchar(8),
          time_slot_id uuid REFERENCES "${schema}".time_slots(id) ON DELETE RESTRICT,
          request_kind varchar(32) NOT NULL DEFAULT 'experience',
          project_id uuid, party_package_id uuid, offering_name_snapshot jsonb,
          offering_price_snapshot varchar(128), slot_date date,
          slot_start_time varchar(8), slot_end_time varchar(8),
          slot_timezone varchar(64) NOT NULL DEFAULT 'Australia/Melbourne',
          idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
          is_read boolean NOT NULL DEFAULT false,
          status varchar(32) NOT NULL DEFAULT 'new',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE "${schema}".cart_orders (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          time_slot_id uuid REFERENCES "${schema}".time_slots(id) ON DELETE RESTRICT
        )
      `);
      connection = createDb(withSearchPath(url, schema));
    });

    afterEach(async () => {
      await connection?.client.end();
      if (bootstrap) {
        await bootstrap.client.unsafe(
          `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
        );
        await bootstrap.client.end();
      }
      connection = undefined;
      bootstrap = undefined;
    });

    async function insertSlot(capacity: number, bookedCount = 0) {
      const id = crypto.randomUUID();
      await connection!.db.insert(timeSlots).values({
        id,
        date: "2026-08-03",
        startTime: "10:00",
        endTime: "11:00",
        capacity,
        bookedCount,
      });
      return id;
    }

    async function bookedCount(id: string) {
      const [row] = await connection!.db
        .select({ bookedCount: timeSlots.bookedCount })
        .from(timeSlots)
        .where(eq(timeSlots.id, id));
      return row?.bookedCount;
    }

    it("never reserves beyond capacity under concurrent transactions", async () => {
      const id = await insertSlot(2);
      const repo = createRequestCapacityRepository(connection!.db);

      const outcomes = await Promise.allSettled([
        repo.reserve(id, 2),
        repo.reserve(id, 2),
      ]);

      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(await bookedCount(id)).toBe(2);
    });

    it("never releases below zero", async () => {
      const id = await insertSlot(2);
      const repo = createRequestCapacityRepository(connection!.db);

      await expect(repo.release(id, 1)).rejects.toMatchObject({
        code: "CAPACITY_CONFLICT",
      });
      expect(await bookedCount(id)).toBe(0);
    });

    it("rolls a reservation back when the surrounding request transaction fails", async () => {
      const id = await insertSlot(2);
      const repo = createRequestCapacityRepository(connection!.db);

      await expect(
        connection!.db.transaction(async (tx) => {
          await repo.reserve(id, 2, tx);
          throw new Error("request insert failed");
        }),
      ).rejects.toThrow("request insert failed");

      expect(await bookedCount(id)).toBe(0);
    });

    it("releases a reservation once and rejects a repeated full release", async () => {
      const id = await insertSlot(4, 2);
      const repo = createRequestCapacityRepository(connection!.db);

      const released = await repo.release(id, 2);
      expect(released.bookedCount).toBe(0);
      await expect(repo.release(id, 2)).rejects.toMatchObject({
        code: "CAPACITY_CONFLICT",
      });
      expect(await bookedCount(id)).toBe(0);
    });

    it("atomically rejects a slot before Melbourne today", async () => {
      const id = crypto.randomUUID();
      await connection!.db.insert(timeSlots).values({
        id,
        date: "2020-01-06",
        startTime: "10:00",
        endTime: "11:00",
        capacity: 2,
      });
      const repo = createRequestCapacityRepository(connection!.db);
      await expect(repo.reserve(id, 1)).rejects.toMatchObject({
        code: "SLOT_IN_PAST",
      });
      expect(await bookedCount(id)).toBe(0);
    });

    it("serializes concurrent overlapping creates with an advisory lock", async () => {
      const service = createTimeSlotsService(connection!.db, {
        now: () => new Date("2026-07-28T00:00:00+10:00"),
      });
      const outcomes = await Promise.allSettled([
        service.create({
          date: "2026-08-03",
          startTime: "10:00",
          endTime: "11:00",
          capacity: 2,
        }),
        service.create({
          date: "2026-08-03",
          startTime: "10:30",
          endTime: "11:30",
          capacity: 2,
        }),
      ]);
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
    });

    it("rejects an overlapping update and deletion of a referenced slot", async () => {
      const first = await insertSlot(2);
      const second = crypto.randomUUID();
      await connection!.db.insert(timeSlots).values({
        id: second,
        date: "2026-08-03",
        startTime: "11:00",
        endTime: "12:00",
        capacity: 2,
      });
      const service = createTimeSlotsService(connection!.db, {
        now: () => new Date("2026-07-28T00:00:00+10:00"),
      });
      await expect(
        service.update(second, { startTime: "10:30" }),
      ).rejects.toMatchObject({ code: "SLOT_OVERLAP" });

      await connection!.db.insert(bookings).values({
        name: "Customer",
        phone: "0430000000",
        timeSlotId: first,
      });
      await expect(service.remove(first)).rejects.toMatchObject({
        code: "SLOT_REFERENCED",
      });
    });

    it("concurrent cancellation releases one booking reservation once", async () => {
      const id = await insertSlot(2, 2);
      const [booking] = await connection!.db
        .insert(bookings)
        .values({
          name: "Customer",
          phone: "0430000000",
          timeSlotId: id,
          numberOfPeople: 2,
          status: "confirmed",
        })
        .returning();
      const first = createAdminBookingsService(connection!.db);
      const second = createAdminBookingsService(connection!.db);
      const outcomes = await Promise.allSettled([
        first.updateStatus(booking.id, "cancelled"),
        second.updateStatus(booking.id, "cancelled"),
      ]);
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(await bookedCount(id)).toBe(0);
    });

    it("releases the legacy default reservation when people was omitted", async () => {
      const id = await insertSlot(2, 1);
      const [booking] = await connection!.db
        .insert(bookings)
        .values({
          name: "Legacy customer",
          phone: "0430000000",
          timeSlotId: id,
          numberOfPeople: null,
          status: "confirmed",
        })
        .returning();
      await createAdminBookingsService(connection!.db).updateStatus(
        booking.id,
        "cancelled",
      );
      expect(await bookedCount(id)).toBe(0);
    });
  },
);
