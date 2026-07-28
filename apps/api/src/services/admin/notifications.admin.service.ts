import type { Db } from "@yezz/db";
import { createNotificationsRepository } from "../../repositories/notifications.repository.js";

export type NotificationsAdminService = ReturnType<typeof createNotificationsAdminService>;

export function createNotificationsAdminService(
  db: Db,
  options: { now?: () => Date } = {},
) {
  const repo = createNotificationsRepository(db);
  const now = options.now ?? (() => new Date());

  return {
    async unreadCount(userId: string) {
      const [bookings, orders] = await Promise.all([
        repo.countUnreadBookings(userId),
        repo.countUnreadOrders(userId),
      ]);
      return { bookings, orders, total: bookings + orders };
    },

    async summary(userId: string) {
      const [bookings, orders, counts] = await Promise.all([
        repo.countUnreadBookings(userId),
        repo.countUnreadOrders(userId),
        repo.summary(now()),
      ]);
      return {
        unseen: { bookings, orders, total: bookings + orders },
        ...counts,
      };
    },
  };
}
