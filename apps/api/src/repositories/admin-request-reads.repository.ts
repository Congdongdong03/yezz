import { adminRequestReads, type Db } from "@yezz/db";
import { and, eq, isNull, sql } from "drizzle-orm";

export function createAdminRequestReadsRepository(db: Db) {
  async function hasRead(
    userId: string,
    request: "booking" | "cartOrder",
    requestId: string,
  ): Promise<boolean> {
    const condition =
      request === "booking"
        ? and(
            eq(adminRequestReads.userId, userId),
            eq(adminRequestReads.bookingId, requestId),
            isNull(adminRequestReads.cartOrderId),
          )
        : and(
            eq(adminRequestReads.userId, userId),
            eq(adminRequestReads.cartOrderId, requestId),
            isNull(adminRequestReads.bookingId),
          );
    const [row] = await db
      .select({ userId: adminRequestReads.userId })
      .from(adminRequestReads)
      .where(condition)
      .limit(1);
    return Boolean(row);
  }

  return {
    async markBookingRead(userId: string, bookingId: string) {
      await db.execute(sql`
        INSERT INTO admin_request_reads (user_id, booking_id)
        VALUES (${userId}::uuid, ${bookingId}::uuid)
        ON CONFLICT (user_id, booking_id) WHERE booking_id IS NOT NULL
        DO UPDATE SET read_at = NOW()
      `);
    },

    async markCartOrderRead(userId: string, cartOrderId: string) {
      await db.execute(sql`
        INSERT INTO admin_request_reads (user_id, cart_order_id)
        VALUES (${userId}::uuid, ${cartOrderId}::uuid)
        ON CONFLICT (user_id, cart_order_id) WHERE cart_order_id IS NOT NULL
        DO UPDATE SET read_at = NOW()
      `);
    },

    async isBookingUnread(userId: string, bookingId: string) {
      return !(await hasRead(userId, "booking", bookingId));
    },

    async isCartOrderUnread(userId: string, cartOrderId: string) {
      return !(await hasRead(userId, "cartOrder", cartOrderId));
    },
  };
}
