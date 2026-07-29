import { bookings, type Db } from "@yezz/db";
import { and, eq, inArray, sql } from "drizzle-orm";

export type LocalInterval = { date: string; startTime: string; endTime: string };

const ACTIVE_PARTY_STATUSES = [
  "awaiting_in_store_payment",
  "confirmed_paid",
  "confirmed",
] as const;

function overlaps(interval: LocalInterval) {
  return [
    eq(bookings.slotDate, interval.date),
    sql`${bookings.slotStartTime} < ${interval.endTime}`,
    sql`${bookings.slotEndTime} > ${interval.startTime}`,
  ];
}

export function createBookingAvailabilityRepository(db: Db) {
  return {
    async sumConfirmedAttendance(interval: LocalInterval, tx: Db = db): Promise<number> {
      const [row] = await tx
        .select({
          attendance: sql<number>`COALESCE(SUM(${bookings.attendanceCount}), 0)::int`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.requestKind, "experience"),
            eq(bookings.status, "confirmed"),
            ...overlaps(interval),
          ),
        );
      return Number(row?.attendance ?? 0);
    },

    async hasExclusivePartyOverlap(interval: LocalInterval, tx: Db = db): Promise<boolean> {
      const [row] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.requestKind, "party"),
            inArray(bookings.status, ACTIVE_PARTY_STATUSES),
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
  };
}

export type BookingAvailabilityRepository = ReturnType<
  typeof createBookingAvailabilityRepository
>;
