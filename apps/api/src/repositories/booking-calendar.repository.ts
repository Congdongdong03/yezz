import {
  bookingPartyDetails,
  bookings,
  emailOutbox,
  studioClosures,
  studioSpecialHours,
  type BookingStatus,
  type Db,
} from "@yezz/db";
import { and, asc, eq } from "drizzle-orm";
import { formatBookingOrderId } from "../lib/email.js";
import { occupiesStudioSchedule } from "../lib/schedule-occupancy.js";
import {
  createStudioScheduleRepository,
  studioScheduleDateValue,
} from "./studio-schedule.repository.js";

export type CalendarBookingReference = {
  bookingId: string;
  bookingNumber: string;
  name: string;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  attendance: number;
  emailFailureCount: number;
};

export type CalendarPartyBlock = {
  bookingId: string;
  bookingNumber: string;
  name: string;
  status: BookingStatus;
  setupStart: string;
  guestStart: string;
  guestEnd: string;
  cleanupEnd: string;
  paymentDeadline: Date | null;
  emailFailureCount: number;
};

export type BookingCalendarInterval = {
  startTime: string;
  endTime: string;
  ordinaryAttendance: number;
  remainingOrdinaryCapacity: number;
  partyBlocked: boolean;
  closed: boolean;
  ordinaryBookings: CalendarBookingReference[];
  partyBookingIds: string[];
};

export type BookingCalendarDay = {
  date: string;
  timeZone: "Australia/Melbourne";
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  specialHours: {
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
    note: string | null;
  } | null;
  closures: Array<{
    id: string;
    startTime: string | null;
    endTime: string | null;
    note: string | null;
  }>;
  intervals: BookingCalendarInterval[];
  ordinaryBookings: CalendarBookingReference[];
  partyBlocks: CalendarPartyBlock[];
  paymentDeadlines: Array<{
    bookingId: string;
    bookingNumber: string;
    deadline: Date;
  }>;
  emailFailures: Array<{
    bookingId: string;
    bookingNumber: string;
    count: number;
  }>;
};

function minutes(value: string): number {
  const [hours = "0", mins = "0"] = value.split(":");
  return Number(hours) * 60 + Number(mins);
}

function time(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(
    value % 60,
  ).padStart(2, "0")}`;
}

function overlaps(
  startTime: string,
  endTime: string,
  intervalStart: string,
  intervalEnd: string,
): boolean {
  return startTime < intervalEnd && endTime > intervalStart;
}

export function createBookingCalendarRepository(db: Db) {
  const scheduleRepository = createStudioScheduleRepository(db);

  return {
    async readDay(date: string): Promise<BookingCalendarDay> {
      const [schedule, bookingRows, closureRows, specialRows, failedRows] =
        await Promise.all([
          scheduleRepository.resolveDay(date),
          db
            .select({
              id: bookings.id,
              name: bookings.name,
              status: bookings.status,
              requestKind: bookings.requestKind,
              attendanceCount: bookings.attendanceCount,
              slotStartTime: bookings.slotStartTime,
              slotEndTime: bookings.slotEndTime,
              createdAt: bookings.createdAt,
              finalSetupStart: bookingPartyDetails.finalSetupStart,
              finalGuestStart: bookingPartyDetails.finalGuestStart,
              finalGuestEnd: bookingPartyDetails.finalGuestEnd,
              finalCleanupEnd: bookingPartyDetails.finalCleanupEnd,
              paymentDeadline: bookingPartyDetails.paymentDeadline,
            })
            .from(bookings)
            .leftJoin(
              bookingPartyDetails,
              eq(bookingPartyDetails.bookingId, bookings.id),
            )
            .where(eq(bookings.slotDate, date))
            .orderBy(asc(bookings.slotStartTime), asc(bookings.createdAt)),
          db
            .select({
              id: studioClosures.id,
              startTime: studioClosures.startTime,
              endTime: studioClosures.endTime,
              note: studioClosures.note,
            })
            .from(studioClosures)
            .where(eq(studioClosures.date, date))
            .orderBy(asc(studioClosures.startTime)),
          db
            .select({
              opensAt: studioSpecialHours.opensAt,
              closesAt: studioSpecialHours.closesAt,
              isClosed: studioSpecialHours.isClosed,
              note: studioSpecialHours.note,
            })
            .from(studioSpecialHours)
            .where(eq(studioSpecialHours.date, date))
            .limit(1),
          db
            .select({
              bookingId: bookings.id,
              createdAt: bookings.createdAt,
              deliveryId: emailOutbox.id,
            })
            .from(emailOutbox)
            .innerJoin(bookings, eq(emailOutbox.bookingId, bookings.id))
            .where(
              and(
                eq(bookings.slotDate, date),
                eq(emailOutbox.deliveryStatus, "failed"),
              ),
            ),
        ]);

      const failureCounts = new Map<string, number>();
      for (const row of failedRows) {
        failureCounts.set(
          row.bookingId,
          (failureCounts.get(row.bookingId) ?? 0) + 1,
        );
      }

      const ordinaryBookings: CalendarBookingReference[] = bookingRows
        .filter(
          (row) =>
            row.requestKind === "experience" &&
            occupiesStudioSchedule(row.requestKind, row.status) &&
            row.attendanceCount !== null &&
            row.slotStartTime !== null &&
            row.slotEndTime !== null,
        )
        .map((row) => ({
          bookingId: row.id,
          bookingNumber: formatBookingOrderId(row.id, row.createdAt),
          name: row.name,
          status: row.status,
          startTime: row.slotStartTime!,
          endTime: row.slotEndTime!,
          attendance: row.attendanceCount!,
          emailFailureCount: failureCounts.get(row.id) ?? 0,
        }));

      const partyBlocks: CalendarPartyBlock[] = bookingRows
        .filter(
          (row) =>
            row.requestKind === "party" &&
            occupiesStudioSchedule(row.requestKind, row.status) &&
            row.finalSetupStart !== null &&
            row.finalGuestStart !== null &&
            row.finalGuestEnd !== null &&
            row.finalCleanupEnd !== null,
        )
        .map((row) => ({
          bookingId: row.id,
          bookingNumber: formatBookingOrderId(row.id, row.createdAt),
          name: row.name,
          status: row.status,
          setupStart: row.finalSetupStart!,
          guestStart: row.finalGuestStart!,
          guestEnd: row.finalGuestEnd!,
          cleanupEnd: row.finalCleanupEnd!,
          paymentDeadline: row.paymentDeadline ?? null,
          emailFailureCount: failureCounts.get(row.id) ?? 0,
        }));

      const intervals: BookingCalendarInterval[] = [];
      if (!schedule.isClosed && schedule.opensAt && schedule.closesAt) {
        for (
          let cursor = minutes(schedule.opensAt);
          cursor < minutes(schedule.closesAt);
          cursor += 30
        ) {
          const startTime = time(cursor);
          const endTime = time(Math.min(cursor + 30, minutes(schedule.closesAt)));
          const matchingOrdinary = ordinaryBookings.filter((booking) =>
            overlaps(
              booking.startTime,
              booking.endTime,
              startTime,
              endTime,
            ),
          );
          const matchingParties = partyBlocks.filter((party) =>
            overlaps(
              party.setupStart,
              party.cleanupEnd,
              startTime,
              endTime,
            ),
          );
          const closed = closureRows.some(
            (closure) =>
              (closure.startTime === null && closure.endTime === null) ||
              (closure.startTime !== null &&
                closure.endTime !== null &&
                overlaps(
                  closure.startTime,
                  closure.endTime,
                  startTime,
                  endTime,
                )),
          );
          const ordinaryAttendance = matchingOrdinary.reduce(
            (sum, booking) => sum + booking.attendance,
            0,
          );
          const partyBlocked = matchingParties.length > 0;
          intervals.push({
            startTime,
            endTime,
            ordinaryAttendance,
            remainingOrdinaryCapacity:
              partyBlocked || closed
                ? 0
                : Math.max(0, 8 - ordinaryAttendance),
            partyBlocked,
            closed,
            ordinaryBookings: matchingOrdinary,
            partyBookingIds: matchingParties.map(
              ({ bookingId }) => bookingId,
            ),
          });
        }
      }

      const bookingIdentity = new Map(
        bookingRows.map((row) => [
          row.id,
          {
            bookingId: row.id,
            bookingNumber: formatBookingOrderId(row.id, row.createdAt),
          },
        ]),
      );

      return {
        date: studioScheduleDateValue(date),
        timeZone: "Australia/Melbourne",
        isClosed: schedule.isClosed,
        opensAt: schedule.opensAt,
        closesAt: schedule.closesAt,
        specialHours: specialRows[0] ?? null,
        closures: closureRows,
        intervals,
        ordinaryBookings,
        partyBlocks,
        paymentDeadlines: partyBlocks.flatMap((party) =>
          party.paymentDeadline
            ? [
                {
                  bookingId: party.bookingId,
                  bookingNumber: party.bookingNumber,
                  deadline: party.paymentDeadline,
                },
              ]
            : [],
        ),
        emailFailures: Array.from(failureCounts, ([bookingId, count]) => ({
          ...(bookingIdentity.get(bookingId) ?? {
            bookingId,
            bookingNumber: bookingId,
          }),
          count,
        })),
      };
    },

    async readRange(from: string, to: string): Promise<BookingCalendarDay[]> {
      const start = new Date(`${from}T00:00:00.000Z`);
      const end = new Date(`${to}T00:00:00.000Z`);
      const days: string[] = [];
      for (
        let cursor = start;
        cursor.getTime() <= end.getTime();
        cursor = new Date(cursor.getTime() + 86_400_000)
      ) {
        days.push(cursor.toISOString().slice(0, 10));
      }
      return Promise.all(days.map((date) => this.readDay(date)));
    },
  };
}
