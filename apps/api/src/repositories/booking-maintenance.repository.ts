import {
  bookingPartyDetails,
  bookings,
  customerActionTokens,
  emailOutbox,
  requestStatusEvents,
  type Db,
  type LocalizedString,
} from "@yezz/db";
import { and, asc, eq, isNotNull, lte, notExists, or, sql } from "drizzle-orm";
import { formatBookingOrderId } from "../lib/email.js";
import { createEmailOutboxRepository } from "./email-outbox.repository.js";

export type BookingReminderCandidate = {
  bookingId: string;
  customerName: string;
  email: string;
  locale: "en" | "zh";
  createdAt: Date;
  offeringLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  amountCents?: 9500 | 14500;
};

export type ExpiredPartyHold = {
  bookingId: string;
  paymentDeadline: Date;
};

export type ReminderEnqueueInput = BookingReminderCandidate & {
  manageUrl: string;
  tokenDigest: string;
  rawToken?: string;
};

function locale(value: string | null): "en" | "zh" {
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function offeringLabel(
  value: LocalizedString | null,
  requestedLocale: "en" | "zh",
  requestKind: string,
): string {
  return (
    value?.[requestedLocale] ??
    value?.en ??
    value?.zh ??
    (requestKind === "party" ? "Party booking" : "DIY booking")
  );
}

export function createBookingMaintenanceRepository(db: Db) {
  const outbox = createEmailOutboxRepository(db);
  const appointmentDate = sql<string>`CASE
    WHEN ${bookings.requestKind} = 'party'
      THEN ${bookingPartyDetails.finalDate}
    ELSE ${bookings.slotDate}
  END`;
  const appointmentStart = sql<string>`CASE
    WHEN ${bookings.requestKind} = 'party'
      THEN ${bookingPartyDetails.finalGuestStart}
    ELSE ${bookings.slotStartTime}
  END`;
  const appointmentEnd = sql<string>`CASE
    WHEN ${bookings.requestKind} = 'party'
      THEN ${bookingPartyDetails.finalGuestEnd}
    ELSE ${bookings.slotEndTime}
  END`;
  const appointmentInstant = sql<Date>`(
    (${appointmentDate} + ${appointmentStart}::time)
    AT TIME ZONE 'Australia/Melbourne'
  )`;
  const authoritativeConfirmationAt = sql<Date | null>`(
    SELECT max(${requestStatusEvents.createdAt})
    FROM ${requestStatusEvents}
    WHERE ${requestStatusEvents.bookingId} = ${bookings.id}
      AND ${requestStatusEvents.toStatus} = CASE
        WHEN ${bookings.requestKind} = 'party' THEN 'confirmed_paid'
        ELSE 'confirmed'
      END
  )`;
  const reminderDedupeKey = sql<string>`(
    'booking:' || ${bookings.id}::text || ':reminder:' ||
    ${appointmentDate}::text || ':' || ${appointmentStart}::text || ':customer'
  )`;
  const reminderStatus = or(
    and(
      eq(bookings.requestKind, "experience"),
      eq(bookings.status, "confirmed"),
    ),
    and(
      eq(bookings.requestKind, "party"),
      eq(bookings.status, "confirmed_paid"),
    ),
  );
  const reminderEligibility = (nowIso: string) =>
    and(
      reminderStatus,
      sql`${appointmentDate} IS NOT NULL`,
      sql`${appointmentStart} IS NOT NULL`,
      sql`${appointmentEnd} IS NOT NULL`,
      sql`${appointmentInstant}
        BETWEEN ${nowIso}::timestamptz + interval '23 hours 55 minutes'
            AND ${nowIso}::timestamptz + interval '24 hours 5 minutes'`,
      sql`${authoritativeConfirmationAt} IS NOT NULL`,
      sql`${authoritativeConfirmationAt} <= ${appointmentInstant} - interval '24 hours'`,
    );

  return {
    async findBookingsNeedingReminder(
      now: Date,
    ): Promise<BookingReminderCandidate[]> {
      const nowIso = now.toISOString();
      const rows = await db
        .select({
          bookingId: bookings.id,
          customerName: bookings.name,
          email: bookings.email,
          locale: bookings.locale,
          createdAt: bookings.createdAt,
          offeringName: bookings.offeringNameSnapshot,
          requestKind: bookings.requestKind,
          date: appointmentDate,
          startTime: appointmentStart,
          endTime: appointmentEnd,
          amountCents: bookingPartyDetails.venueFeeCents,
        })
        .from(bookings)
        .leftJoin(
          bookingPartyDetails,
          eq(bookingPartyDetails.bookingId, bookings.id),
        )
        .where(
          and(
            isNotNull(bookings.email),
            reminderEligibility(nowIso),
            notExists(
              db
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupeKey, reminderDedupeKey)),
            ),
          ),
        )
        .orderBy(asc(appointmentInstant), asc(bookings.id));

      return rows.map((row) => {
        const bookingLocale = locale(row.locale);
        const amountCents =
          row.requestKind === "party" &&
          (row.amountCents === 9500 || row.amountCents === 14500)
            ? (row.amountCents as 9500 | 14500)
            : undefined;
        return {
          bookingId: row.bookingId,
          customerName: row.customerName,
          email: row.email!,
          locale: bookingLocale,
          createdAt: row.createdAt,
          offeringLabel: offeringLabel(
            row.offeringName,
            bookingLocale,
            row.requestKind,
          ),
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          ...(amountCents === undefined ? {} : { amountCents }),
        };
      });
    },

    async findExpiredPartyHolds(now: Date): Promise<ExpiredPartyHold[]> {
      return db
        .select({
          bookingId: bookings.id,
          paymentDeadline: bookingPartyDetails.paymentDeadline,
        })
        .from(bookings)
        .innerJoin(
          bookingPartyDetails,
          eq(bookingPartyDetails.bookingId, bookings.id),
        )
        .where(
          and(
            eq(bookings.requestKind, "party"),
            eq(bookings.status, "awaiting_in_store_payment"),
            isNotNull(bookingPartyDetails.paymentDeadline),
            lte(bookingPartyDetails.paymentDeadline, now),
          ),
        )
        .orderBy(asc(bookingPartyDetails.paymentDeadline), asc(bookings.id))
        .then((rows) =>
          rows.map((row) => ({
            bookingId: row.bookingId,
            paymentDeadline: row.paymentDeadline!,
          })),
        );
    },

    async markReminderEnqueued(
      input: ReminderEnqueueInput,
      now: Date,
    ): Promise<boolean> {
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Db;
        const nowIso = now.toISOString();
        const dedupeKey = `booking:${input.bookingId}:reminder:${input.date}:${input.startTime}:customer`;
        const [locked] = await tx
          .select({ bookingId: bookings.id })
          .from(bookings)
          .where(eq(bookings.id, input.bookingId))
          .limit(1)
          .for("update");
        if (!locked) return false;

        const [eligible] = await tx
          .select({ bookingId: bookings.id })
          .from(bookings)
          .leftJoin(
            bookingPartyDetails,
            eq(bookingPartyDetails.bookingId, bookings.id),
          )
          .where(
            and(
              eq(bookings.id, input.bookingId),
              reminderEligibility(nowIso),
              sql`${appointmentDate} = ${input.date}::date`,
              sql`${appointmentStart} = ${input.startTime}`,
              sql`${appointmentEnd} = ${input.endTime}`,
              notExists(
                tx
                  .select({ id: emailOutbox.id })
                  .from(emailOutbox)
                  .where(eq(emailOutbox.dedupeKey, dedupeKey)),
              ),
            ),
          )
          .limit(1);
        if (!eligible) return false;

        await tx
          .insert(customerActionTokens)
          .values({
            bookingId: input.bookingId,
            tokenDigest: input.tokenDigest,
            scopes: ["request_cancellation", "request_reschedule"],
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          })
          .onConflictDoNothing({
            target: customerActionTokens.tokenDigest,
          });

        await outbox.enqueue(
          {
            dedupeKey,
            bookingId: input.bookingId,
            messageType: "booking_notification_customer",
            recipient: input.email,
            locale: input.locale,
            payload: {
              template: "booking_reminder",
              customerName: input.customerName,
              bookingNumber: formatBookingOrderId(
                input.bookingId,
                input.createdAt,
              ),
              offeringLabel: input.offeringLabel,
              date: input.date,
              startTime: input.startTime,
              endTime: input.endTime,
              manageUrl: input.manageUrl,
              storeName: "YezYY",
              contactEmail: "congdongdong03@gmail.com",
              contactPhone: "0430 787 712",
            },
          },
          tx,
        );
        return true;
      });
    },
  };
}

export type BookingMaintenanceRepository = ReturnType<
  typeof createBookingMaintenanceRepository
>;
