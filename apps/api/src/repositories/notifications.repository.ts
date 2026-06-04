import { bookings, cartOrders, type Db } from "@yezz/db";
import { eq, sql } from "drizzle-orm";

export function createNotificationsRepository(db: Db) {
  return {
    async countUnreadBookings() {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(eq(bookings.isRead, false));
      return row?.count ?? 0;
    },

    async countUnreadOrders() {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cartOrders)
        .where(eq(cartOrders.isRead, false));
      return row?.count ?? 0;
    },

    async markBookingsRead() {
      await db.update(bookings).set({ isRead: true });
    },

    async markOrdersRead() {
      await db.update(cartOrders).set({ isRead: true });
    },
  };
}
