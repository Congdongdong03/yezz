import { timeSlots, type Db } from "@yezz/db";
import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

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

    findByDate(date: string, categoryId?: string | null) {
      const conditions = [eq(timeSlots.date, date)];
      if (categoryId) {
        conditions.push(
          or(isNull(timeSlots.categoryId), eq(timeSlots.categoryId, categoryId))!,
        );
      }
      return db
        .select()
        .from(timeSlots)
        .where(and(...conditions))
        .orderBy(asc(timeSlots.startTime));
    },

    findInMonth(year: number, month: number, categoryId?: string | null) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const conditions = [gte(timeSlots.date, start), lte(timeSlots.date, end)];
      if (categoryId) {
        conditions.push(
          or(isNull(timeSlots.categoryId), eq(timeSlots.categoryId, categoryId))!,
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

    async create(input: TimeSlotCreateInput) {
      const [row] = await db
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

    async createMany(inputs: TimeSlotCreateInput[]) {
      if (inputs.length === 0) return [];
      return db
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
        .onConflictDoNothing()
        .returning();
    },

    async update(id: string, input: TimeSlotUpdateInput) {
      const [row] = await db
        .update(timeSlots)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(timeSlots.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id: string) {
      const [row] = await db.delete(timeSlots).where(eq(timeSlots.id, id)).returning({ id: timeSlots.id });
      return row ?? null;
    },

    async incrementBookedCount(id: string, delta: number, tx: Db = db) {
      const [row] = await tx
        .update(timeSlots)
        .set({
          bookedCount: sql`${timeSlots.bookedCount} + ${delta}`,
          updatedAt: new Date(),
        })
        .where(eq(timeSlots.id, id))
        .returning();
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
  };
}
