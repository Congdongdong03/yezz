import {
  adminRequestReads,
  bookings,
  cartOrders,
  emailOutbox,
  type Db,
} from "@yezz/db";
import { and, count, eq, isNull, lt, sql } from "drizzle-orm";
import { getMelbourneDate } from "../lib/slot-policy.js";

export function createNotificationsRepository(db: Db) {
  return {
    async countUnreadBookings(userId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .leftJoin(
          adminRequestReads,
          and(
            eq(adminRequestReads.userId, userId),
            eq(adminRequestReads.bookingId, bookings.id),
          ),
        )
        .where(isNull(adminRequestReads.userId));
      return row?.count ?? 0;
    },

    async countUnreadOrders(userId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cartOrders)
        .leftJoin(
          adminRequestReads,
          and(
            eq(adminRequestReads.userId, userId),
            eq(adminRequestReads.cartOrderId, cartOrders.id),
          ),
        )
        .where(isNull(adminRequestReads.userId));
      return row?.count ?? 0;
    },

    async summary(now: Date) {
      const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const melbourneToday = getMelbourneDate(now);
      const countByStatus = async (status: "new" | "contacted") => {
        const [[booking], [order]] = await Promise.all([
          db
            .select({ count: count() })
            .from(bookings)
            .where(eq(bookings.status, status)),
          db
            .select({ count: count() })
            .from(cartOrders)
            .where(eq(cartOrders.status, status)),
        ]);
        return Number(booking?.count ?? 0) + Number(order?.count ?? 0);
      };
      const [[overdueBookings], [overdueOrders], [confirmedBookings], [confirmedOrders], [failedEmails]] =
        await Promise.all([
          db
            .select({ count: count() })
            .from(bookings)
            .where(and(eq(bookings.status, "new"), lt(bookings.createdAt, cutoff))),
          db
            .select({ count: count() })
            .from(cartOrders)
            .where(and(eq(cartOrders.status, "new"), lt(cartOrders.createdAt, cutoff))),
          db
            .select({ count: count() })
            .from(bookings)
            .where(
              and(
                eq(bookings.status, "confirmed"),
                sql`(${bookings.updatedAt} AT TIME ZONE 'Australia/Melbourne')::date = ${melbourneToday}::date`,
              ),
            ),
          db
            .select({ count: count() })
            .from(cartOrders)
            .where(
              and(
                eq(cartOrders.status, "confirmed"),
                sql`(${cartOrders.updatedAt} AT TIME ZONE 'Australia/Melbourne')::date = ${melbourneToday}::date`,
              ),
            ),
          db
            .select({ count: count() })
            .from(emailOutbox)
            .where(eq(emailOutbox.deliveryStatus, "failed")),
        ]);
      const [newCount, contacted] = await Promise.all([
        countByStatus("new"),
        countByStatus("contacted"),
      ]);
      return {
        new: newCount,
        contacted,
        overdue: Number(overdueBookings?.count ?? 0) + Number(overdueOrders?.count ?? 0),
        confirmedToday:
          Number(confirmedBookings?.count ?? 0) + Number(confirmedOrders?.count ?? 0),
        emailFailures: Number(failedEmails?.count ?? 0),
      };
    },

  };
}
