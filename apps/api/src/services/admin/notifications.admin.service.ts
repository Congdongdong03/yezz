import type { Db } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import { createNotificationsRepository } from "../../repositories/notifications.repository.js";

export type NotificationsAdminService = ReturnType<typeof createNotificationsAdminService>;

export function createNotificationsAdminService(db: Db) {
  const repo = createNotificationsRepository(db);

  return {
    async unreadCount() {
      const [bookings, orders] = await Promise.all([
        repo.countUnreadBookings(),
        repo.countUnreadOrders(),
      ]);
      return { bookings, orders, total: bookings + orders };
    },

    async markRead(type: "bookings" | "orders") {
      if (type === "bookings") {
        await repo.markBookingsRead();
        return { type };
      }
      if (type === "orders") {
        await repo.markOrdersRead();
        return { type };
      }
      throw new AppError(400, "VALIDATION_ERROR", "type must be bookings or orders");
    },
  };
}
