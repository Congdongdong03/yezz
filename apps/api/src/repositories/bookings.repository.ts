import { bookings, type Db } from "@yezz/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { lockPublicCreateAttempt } from "../lib/public-create-idempotency.js";

export type OrderStatus = "new" | "contacted" | "confirmed" | "cancelled";

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

    async findAllOrdered(opts?: { limit?: number; offset?: number; status?: OrderStatus }) {
      const conditions = opts?.status ? [eq(bookings.status, opts.status)] : [];
      const query = db
        .select()
        .from(bookings)
        .orderBy(desc(bookings.createdAt));

      const [totalRow] = await db
        .select({ total: count() })
        .from(bookings)
        .where(conditions.length ? conditions[0] : sql`true`);

      const rows = await db
        .select()
        .from(bookings)
        .where(conditions.length ? conditions[0] : sql`true`)
        .orderBy(desc(bookings.createdAt))
        .limit(opts?.limit ?? 100)
        .offset(opts?.offset ?? 0);

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
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(bookings.id, id),
            eq(bookings.status, expectedStatus),
          ),
        )
        .returning();
      return row ?? null;
    },
  };
}
