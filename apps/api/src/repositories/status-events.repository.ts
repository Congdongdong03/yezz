import { requestStatusEvents, users, type Db } from "@yezz/db";
import { asc, eq, sql } from "drizzle-orm";

export type RequestStatus = "new" | "contacted" | "confirmed" | "cancelled";

export type CreateBookingStatusEventInput = {
  bookingId: string;
  operationId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  adminNote?: string | null;
  actorUserId: string;
};

export type CreateCartOrderStatusEventInput = Omit<
  CreateBookingStatusEventInput,
  "bookingId"
> & {
  cartOrderId: string;
};

export function createStatusEventsRepository(db: Db) {
  return {
    async lockOperation(operationId: string, tx: Db = db): Promise<void> {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${operationId}, 0))`,
      );
    },

    async findByOperationId(operationId: string, tx: Db = db) {
      const [row] = await tx
        .select()
        .from(requestStatusEvents)
        .where(eq(requestStatusEvents.operationId, operationId))
        .limit(1);
      return row ?? null;
    },

    async createBooking(
      input: CreateBookingStatusEventInput,
      tx: Db = db,
    ) {
      const [row] = await tx
        .insert(requestStatusEvents)
        .values({
          bookingId: input.bookingId,
          operationId: input.operationId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          adminNote: input.adminNote?.trim() || null,
          actorUserId: input.actorUserId,
        })
        .returning();
      return row;
    },

    async createCartOrder(
      input: CreateCartOrderStatusEventInput,
      tx: Db = db,
    ) {
      const [row] = await tx
        .insert(requestStatusEvents)
        .values({
          cartOrderId: input.cartOrderId,
          operationId: input.operationId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          adminNote: input.adminNote?.trim() || null,
          actorUserId: input.actorUserId,
        })
        .returning();
      return row;
    },

    listForBooking(bookingId: string) {
      return db
        .select({
          id: requestStatusEvents.id,
          operationId: requestStatusEvents.operationId,
          fromStatus: requestStatusEvents.fromStatus,
          toStatus: requestStatusEvents.toStatus,
          note: requestStatusEvents.adminNote,
          createdAt: requestStatusEvents.createdAt,
          actorId: users.id,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(requestStatusEvents)
        .innerJoin(users, eq(requestStatusEvents.actorUserId, users.id))
        .where(eq(requestStatusEvents.bookingId, bookingId))
        .orderBy(asc(requestStatusEvents.createdAt));
    },

    listForCartOrder(cartOrderId: string) {
      return db
        .select({
          id: requestStatusEvents.id,
          operationId: requestStatusEvents.operationId,
          fromStatus: requestStatusEvents.fromStatus,
          toStatus: requestStatusEvents.toStatus,
          note: requestStatusEvents.adminNote,
          createdAt: requestStatusEvents.createdAt,
          actorId: users.id,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(requestStatusEvents)
        .innerJoin(users, eq(requestStatusEvents.actorUserId, users.id))
        .where(eq(requestStatusEvents.cartOrderId, cartOrderId))
        .orderBy(asc(requestStatusEvents.createdAt));
    },
  };
}
