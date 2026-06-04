import type { FastifyInstance } from "fastify";
import { success } from "../../../lib/response.js";

export default async function adminNotificationsRoutes(app: FastifyInstance) {
  app.get("/unread-count", async () => {
    const data = await app.services.adminNotifications.unreadCount();
    return success(data);
  });

  app.patch<{ Querystring: { type?: string } }>("/mark-read", async (request) => {
    const type = request.query.type;
    if (type !== "bookings" && type !== "orders") {
      return success({ ok: false });
    }
    const data = await app.services.adminNotifications.markRead(type);
    return success(data);
  });
}
