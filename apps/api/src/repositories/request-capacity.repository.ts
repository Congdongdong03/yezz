import { timeSlots, type Db } from "@yezz/db";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "../lib/errors.js";

export type SlotSnapshot = Readonly<{
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: "Australia/Melbourne";
  capacity: number;
  bookedCount: number;
  categoryId: string | null;
}>;

function assertPeople(people: number): void {
  if (!Number.isInteger(people) || people < 1) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "people must be a positive integer",
    );
  }
}

type SlotRow = typeof timeSlots.$inferSelect;

function snapshot(row: SlotRow): SlotSnapshot {
  const date =
    typeof row.date === "string" ? row.date : String(row.date).slice(0, 10);
  return Object.freeze({
    id: row.id,
    date,
    startTime: row.startTime,
    endTime: row.endTime,
    timeZone: "Australia/Melbourne",
    capacity: row.capacity,
    bookedCount: row.bookedCount,
    categoryId: row.categoryId ?? null,
  });
}

export function createRequestCapacityRepository(db: Db) {
  return {
    async reserve(
      slotId: string,
      people: number,
      tx: Db = db,
    ): Promise<SlotSnapshot> {
      assertPeople(people);
      const [row] = await tx
        .update(timeSlots)
        .set({
          bookedCount: sql`${timeSlots.bookedCount} + ${people}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(timeSlots.id, slotId),
            eq(timeSlots.isAvailable, true),
            sql`${timeSlots.bookedCount} + ${people} <= ${timeSlots.capacity}`,
          ),
        )
        .returning();
      if (!row) {
        throw new AppError(
          409,
          "SLOT_FULL",
          "The selected time slot is unavailable or does not have enough capacity",
        );
      }
      return snapshot(row);
    },

    async release(
      slotId: string,
      people: number,
      tx: Db = db,
    ): Promise<SlotSnapshot> {
      assertPeople(people);
      const [row] = await tx
        .update(timeSlots)
        .set({
          bookedCount: sql`${timeSlots.bookedCount} - ${people}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(timeSlots.id, slotId),
            sql`${timeSlots.bookedCount} >= ${people}`,
          ),
        )
        .returning();
      if (!row) {
        throw new AppError(
          409,
          "CAPACITY_CONFLICT",
          "The time-slot reservation was already released or no longer exists",
        );
      }
      return snapshot(row);
    },
  };
}
