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

function formatSlotDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function snapshot(row: SlotRow): SlotSnapshot {
  return Object.freeze({
    id: row.id,
    date: formatSlotDate(row.date),
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
            sql`${timeSlots.date} >= ((CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Melbourne')::date)`,
            sql`${timeSlots.bookedCount} + ${people} <= ${timeSlots.capacity}`,
          ),
        )
        .returning();
      if (!row) {
        const [existing] = await tx
          .select({
            isPast: sql<boolean>`${timeSlots.date} < ((CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Melbourne')::date)`,
          })
          .from(timeSlots)
          .where(eq(timeSlots.id, slotId))
          .limit(1);
        if (existing?.isPast) {
          throw new AppError(
            409,
            "SLOT_IN_PAST",
            "The selected time slot is in the past in Australia/Melbourne",
          );
        }
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
