import { bookings, cartOrders, timeSlots, type Db } from "@yezz/db";
import { and, asc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";

export type TimeSlotCreateInput = {
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  categoryId?: string | null;
  notes?: string | null;
};

export type TimeSlotUpdateInput = Partial<{
  startTime: string;
  endTime: string;
  capacity: number;
  categoryId: string | null;
  isAvailable: boolean;
  notes: string | null;
}>;

export function createTimeSlotsRepository(db: Db) {
  return {
    findById(id: string) {
      return db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, id))
        .limit(1)
        .then((rows) => rows[0] ?? null);
    },

    findByDate(date: string, categoryId?: string | null, minimumDate?: string) {
      const conditions = [eq(timeSlots.date, date)];
      if (minimumDate) conditions.push(gte(timeSlots.date, minimumDate));
      if (categoryId === null) {
        conditions.push(isNull(timeSlots.categoryId));
      } else if (categoryId) {
        conditions.push(
          or(
            isNull(timeSlots.categoryId),
            eq(timeSlots.categoryId, categoryId),
          )!,
        );
      }
      return db
        .select()
        .from(timeSlots)
        .where(and(...conditions))
        .orderBy(asc(timeSlots.startTime));
    },

    findInMonth(
      year: number,
      month: number,
      categoryId?: string | null,
      minimumDate?: string,
    ) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const conditions = [gte(timeSlots.date, start), lte(timeSlots.date, end)];
      if (minimumDate) conditions.push(gte(timeSlots.date, minimumDate));
      if (categoryId === null) {
        conditions.push(isNull(timeSlots.categoryId));
      } else if (categoryId) {
        conditions.push(
          or(
            isNull(timeSlots.categoryId),
            eq(timeSlots.categoryId, categoryId),
          )!,
        );
      }

      return db
        .select()
        .from(timeSlots)
        .where(and(...conditions))
        .orderBy(asc(timeSlots.date), asc(timeSlots.startTime));
    },

    findAllOrdered() {
      return db
        .select()
        .from(timeSlots)
        .orderBy(asc(timeSlots.date), asc(timeSlots.startTime));
    },

    async create(input: TimeSlotCreateInput, tx: Db = db) {
      const [row] = await tx
        .insert(timeSlots)
        .values({
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          capacity: input.capacity,
          categoryId: input.categoryId ?? null,
          notes: input.notes?.trim() || null,
          updatedAt: new Date(),
        })
        .returning();
      return row;
    },

    async createMany(inputs: TimeSlotCreateInput[], tx: Db = db) {
      if (inputs.length === 0) return [];
      return tx
        .insert(timeSlots)
        .values(
          inputs.map((input) => ({
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            capacity: input.capacity,
            categoryId: input.categoryId ?? null,
            notes: input.notes?.trim() || null,
            updatedAt: new Date(),
          })),
        )
        .returning();
    },

    async update(id: string, input: TimeSlotUpdateInput, tx: Db = db) {
      const [row] = await tx
        .update(timeSlots)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(timeSlots.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id: string, tx: Db = db) {
      const [row] = await tx
        .delete(timeSlots)
        .where(eq(timeSlots.id, id))
        .returning({ id: timeSlots.id });
      return row ?? null;
    },

    async findByIdForUpdate(id: string, tx: Db = db) {
      const [row] = await tx
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, id))
        .for("update")
        .limit(1);
      return row ?? null;
    },

    async acquireScheduleLocks(
      keys: Array<{ date: string; categoryId?: string | null }>,
      tx: Db = db,
    ) {
      const normalized = [
        ...new Set(
          keys.map(
            ({ date, categoryId }) => `${date}:${categoryId ?? "global"}`,
          ),
        ),
      ].sort();
      for (const key of normalized) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
        );
      }
    },

    async findOverlapping(
      input: {
        date: string;
        startTime: string;
        endTime: string;
        categoryId?: string | null;
        excludeId?: string;
      },
      tx: Db = db,
    ) {
      const categoryCondition = input.categoryId
        ? eq(timeSlots.categoryId, input.categoryId)
        : isNull(timeSlots.categoryId);
      const conditions = [
        eq(timeSlots.date, input.date),
        categoryCondition,
        sql`${timeSlots.startTime} < ${input.endTime}`,
        sql`${timeSlots.endTime} > ${input.startTime}`,
      ];
      if (input.excludeId) conditions.push(ne(timeSlots.id, input.excludeId));
      const [row] = await tx
        .select()
        .from(timeSlots)
        .where(and(...conditions))
        .limit(1);
      return row ?? null;
    },

    async hasRequestReferences(id: string, tx: Db = db): Promise<boolean> {
      const [booking] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.timeSlotId, id))
        .limit(1);
      if (booking) return true;
      const [order] = await tx
        .select({ id: cartOrders.id })
        .from(cartOrders)
        .where(eq(cartOrders.timeSlotId, id))
        .limit(1);
      return Boolean(order);
    },
  };
}
