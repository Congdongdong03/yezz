import { bookings, type Db } from "@yezz/db";
import { count, desc, eq, sql } from "drizzle-orm";

export type OrderStatus = "new" | "contacted" | "confirmed" | "cancelled";

export type BookingCreateInput = {
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

export function createBookingsRepository(db: Db) {
  return {
    async create(input: BookingCreateInput, tx: Db = db) {
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

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);
      return row ?? null;
    },

    async updateStatus(id: string, status: OrderStatus, tx: Db = db) {
      const [row] = await tx
        .update(bookings)
        .set({ status, updatedAt: new Date() })
        .where(eq(bookings.id, id))
        .returning();
      return row ?? null;
    },
  };
}
