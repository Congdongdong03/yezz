import {
  adminRequestReads,
  bookings,
  requestStatusEvents,
  type Db,
} from "@yezz/db";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  bookingStatusFromLegacyStatus,
  type LegacyBookingStatus,
} from "../lib/legacy-booking-status.js";
import { lockPublicCreateAttempt } from "../lib/public-create-idempotency.js";

export type OrderStatus = LegacyBookingStatus;

const latestBookingTransitionStatus = sql<string | null>`(
  SELECT ${requestStatusEvents.toStatus}
  FROM ${requestStatusEvents}
  WHERE ${requestStatusEvents.bookingId} = ${bookings.id}
  ORDER BY ${requestStatusEvents.createdAt} DESC, ${requestStatusEvents.id} DESC
  LIMIT 1
)`;

export function legacyBookingStatusCondition(status: OrderStatus) {
  switch (status) {
    case "new":
      return and(
        eq(bookings.status, "pending_review"),
        or(
          isNull(latestBookingTransitionStatus),
          ne(latestBookingTransitionStatus, "contacted"),
        ),
      );
    case "contacted":
      return and(
        eq(bookings.status, "pending_review"),
        eq(latestBookingTransitionStatus, "contacted"),
      );
    case "confirmed":
    case "cancelled":
      return eq(bookings.status, bookingStatusFromLegacyStatus(status));
  }
}

type BookingContactInput = {
  name: string;
  phone: string;
  wechat?: string | null;
  email?: string | null;
  preferredDate?: string | null;
  numberOfPeople?: number | null;
  activityType?: string | null;
  interestedProject?: string | null;
  message?: string | null;
  locale?: string | null;
  timeSlotId?: string | null;
};

export type ExperienceBookingCreateInput = BookingContactInput & {
  kind?: "experience";
  projectId?: string | null;
  partyPackageId?: null;
};

export type PartyBookingCreateInput = BookingContactInput & {
  kind: "party";
  projectId?: null;
  partyPackageId?: string | null;
};

export type BookingCreateInput =
  | ExperienceBookingCreateInput
  | PartyBookingCreateInput;

export type BookingInsertInput = BookingContactInput & {
  kind: "experience" | "party";
  requestKind: "experience" | "party";
  projectId: string | null;
  partyPackageId: string | null;
  offeringNameSnapshot: { en: string; zh: string } | null;
  offeringPriceSnapshot: string | null;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  slotTimezone: "Australia/Melbourne";
  idempotencyKey: string;
};

export function createBookingsRepository(db: Db) {
  return {
    async lockCreateAttempt(idempotencyKey: string, tx: Db = db) {
      await lockPublicCreateAttempt(tx, "booking", idempotencyKey);
    },

    async create(input: BookingInsertInput, tx: Db = db) {
      const [row] = await tx
        .insert(bookings)
        .values({
          name: input.name.trim(),
          phone: input.phone.trim(),
          wechat: input.wechat?.trim() || null,
          email: input.email?.trim() || null,
          preferredDate: input.preferredDate?.trim() || null,
          numberOfPeople: input.numberOfPeople ?? null,
          activityType: input.activityType?.trim() || null,
          interestedProject: input.interestedProject?.trim() || null,
          message: input.message?.trim() || null,
          locale: input.locale?.trim() || null,
          timeSlotId: input.timeSlotId ?? null,
          requestKind: input.requestKind,
          projectId: input.projectId,
          partyPackageId: input.partyPackageId,
          offeringNameSnapshot: input.offeringNameSnapshot,
          offeringPriceSnapshot: input.offeringPriceSnapshot,
          slotDate: input.slotDate,
          slotStartTime: input.slotStartTime,
          slotEndTime: input.slotEndTime,
          slotTimezone: input.slotTimezone,
          idempotencyKey: input.idempotencyKey,
          isRead: false,
          updatedAt: new Date(),
        })
        .returning();
      return row;
    },

    async findAllOrdered(opts: {
      userId: string;
      limit: number;
      offset: number;
      status?: OrderStatus;
      search?: string;
      unreadOnly?: boolean;
      overdue?: boolean;
      confirmedToday?: boolean;
    }) {
      const readJoin = and(
        eq(adminRequestReads.userId, opts.userId),
        eq(adminRequestReads.bookingId, bookings.id),
      );
      const search = opts.search?.trim();
      const conditions = [
        ...(opts.status ? [legacyBookingStatusCondition(opts.status)] : []),
        ...(search
          ? [
              or(
                ilike(bookings.name, `%${search}%`),
                ilike(bookings.phone, `%${search}%`),
                ilike(bookings.email, `%${search}%`),
                ilike(bookings.wechat, `%${search}%`),
              ),
            ]
          : []),
        ...(opts.unreadOnly ? [isNull(adminRequestReads.userId)] : []),
        ...(opts.overdue
          ? [
              and(
                legacyBookingStatusCondition("new"),
                lt(bookings.createdAt, new Date(Date.now() - 2 * 60 * 60 * 1000)),
              ),
            ]
          : []),
        ...(opts.confirmedToday
          ? [
              and(
                eq(bookings.status, "confirmed"),
                sql`(${bookings.updatedAt} AT TIME ZONE 'Australia/Melbourne')::date = ((CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Melbourne')::date)`,
              ),
            ]
          : []),
      ];
      const condition = conditions.length ? and(...conditions) : undefined;

      const [totalRow] = await db
        .select({ total: count() })
        .from(bookings)
        .leftJoin(adminRequestReads, readJoin)
        .where(condition);

      const rows = await db
        .select({
          row: bookings,
          isUnread: sql<boolean>`${adminRequestReads.userId} IS NULL`,
          latestTransitionStatus: latestBookingTransitionStatus,
        })
        .from(bookings)
        .leftJoin(adminRequestReads, readJoin)
        .where(condition)
        .orderBy(
          sql`CASE
            WHEN ${bookings.status} = 'pending_review'
              AND ${latestBookingTransitionStatus} = 'contacted' THEN 1
            WHEN ${bookings.status} = 'pending_review' THEN 0
            ELSE 2
          END`,
          desc(bookings.createdAt),
        )
        .limit(opts.limit)
        .offset(opts.offset);

      return { rows, total: Number(totalRow?.total ?? 0) };
    },

    async findById(id: string, tx: Db = db) {
      const [row] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);
      return row ?? null;
    },

    async findByIdempotencyKey(idempotencyKey: string, tx: Db = db) {
      const [row] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.idempotencyKey, idempotencyKey))
        .limit(1);
      return row ?? null;
    },

    async compareAndSetStatus(
      id: string,
      expectedStatus: OrderStatus,
      status: OrderStatus,
      tx: Db = db,
    ) {
      const [row] = await tx
        .update(bookings)
        .set({
          status: bookingStatusFromLegacyStatus(status),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, id),
            legacyBookingStatusCondition(expectedStatus),
          ),
        )
        .returning();
      return row ?? null;
    },
  };
}
