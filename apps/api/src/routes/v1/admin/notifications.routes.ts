import type { FastifyInstance } from "fastify";
import { success } from "../../../lib/response.js";

export default async function adminNotificationsRoutes(app: FastifyInstance) {
  app.get("/unread-count", async (request) => {
    const data = await app.services.adminNotifications.unreadCount(request.user.sub);
    return success(data);
  });

  app.get("/summary", async (request) => {
    const data = await app.services.adminNotifications.summary(request.user.sub);
    return success(data);
  });
}
