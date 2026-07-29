import { bookings, type Db } from "@yezz/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  OCCUPYING_EXPERIENCE_STATUSES,
  OCCUPYING_PARTY_STATUSES,
} from "../lib/schedule-occupancy.js";

export type LocalInterval = { date: string; startTime: string; endTime: string };
export type AvailabilityQueryOptions = { excludeBookingId?: string };

function overlaps(interval: LocalInterval) {
  return [
    eq(bookings.slotDate, interval.date),
    sql`${bookings.slotStartTime} < ${interval.endTime}`,
    sql`${bookings.slotEndTime} > ${interval.startTime}`,
  ];
}

export function createBookingAvailabilityRepository(db: Db) {
  return {
    async sumConfirmedAttendance(interval: LocalInterval, tx: Db = db, options: AvailabilityQueryOptions = {}): Promise<number> {
      const [row] = await tx
        .select({
          attendance: sql<number>`COALESCE(SUM(${bookings.attendanceCount}), 0)::int`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.requestKind, "experience"),
            inArray(bookings.status, OCCUPYING_EXPERIENCE_STATUSES),
            ...(options.excludeBookingId ? [sql`${bookings.id} <> ${options.excludeBookingId}`] : []),
            ...overlaps(interval),
          ),
        );
      return Number(row?.attendance ?? 0);
    },

    async hasExclusivePartyOverlap(interval: LocalInterval, tx: Db = db, options: AvailabilityQueryOptions = {}): Promise<boolean> {
      const [row] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.requestKind, "party"),
            inArray(bookings.status, OCCUPYING_PARTY_STATUSES),
            ...(options.excludeBookingId ? [sql`${bookings.id} <> ${options.excludeBookingId}`] : []),
            ...overlaps(interval),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async lockOperationalDate(date: string, tx: Db): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${date}, 0))`,
      );
    },

    async lockScheduleRevision(tx: Db): Promise<void> {
      await tx.execute(sql`select pg_advisory_xact_lock(149978, 1126)`);
    },
  };
}

export type BookingAvailabilityRepository = ReturnType<
  typeof createBookingAvailabilityRepository
>;
