import type { FastifyInstance } from "fastify";
import { AppError } from "../../../lib/errors.js";
import { enforceRequestLimit } from "../../../lib/public-request-limit.js";
import adminBookingsRoutes from "./bookings.routes.js";
import adminCatalogueRoutes from "./catalogue.routes.js";
import adminOrdersRoutes from "./orders.routes.js";
import adminCategoriesRoutes from "./categories.routes.js";
import adminGalleryRoutes from "./gallery.routes.js";
import adminMeRoutes from "./me.routes.js";
import adminNotificationsRoutes from "./notifications.routes.js";
import adminPartiesRoutes from "./parties.routes.js";
import adminProjectsRoutes from "./projects.routes.js";
import adminSettingsRoutes from "./settings.routes.js";
import adminTimeSlotsRoutes from "./time-slots.routes.js";
import adminUploadRoutes from "./upload.routes.js";
import adminUsersRoutes from "./users.routes.js";
import adminEmailDeliveriesRoutes from "./email-deliveries.routes.js";

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;

    const method = request.method;
    const url = request.url.split("?")[0];
    const userId = request.user?.sub;
    if (!userId) {
      throw new AppError(
        503,
        "RATE_LIMIT_UNAVAILABLE",
        "Please try again shortly.",
      );
    }

    let limit: number;
    let scope: string;

    if (
      method === "POST" &&
      (url === "/upload" ||
        url.startsWith("/upload/") ||
        url === "/admin/upload" ||
        url.startsWith("/admin/upload/") ||
        url === "/api/v1/admin/upload" ||
        url.startsWith("/api/v1/admin/upload/"))
    ) {
      limit = 50;
      scope = "admin-upload";
    } else if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      limit = 200;
      scope = "admin-write";
    } else {
      limit = 300;
      scope = "admin-read";
    }

    await enforceRequestLimit(
      app.services.rateLimits,
      scope,
      userId,
      limit,
      3600,
      reply,
    );
  });

  await app.register(adminMeRoutes);
  await app.register(adminNotificationsRoutes, { prefix: "/notifications" });
  await app.register(adminBookingsRoutes, { prefix: "/bookings" });
  await app.register(adminOrdersRoutes, { prefix: "/orders" });
  await app.register(adminTimeSlotsRoutes, { prefix: "/time-slots" });
  await app.register(adminEmailDeliveriesRoutes, { prefix: "/email-deliveries" });
  await app.register(adminUploadRoutes, { prefix: "/upload" });

  await app.register(async (adminOnly) => {
    adminOnly.addHook("onRequest", app.requireAdmin);
    await adminOnly.register(adminCatalogueRoutes, { prefix: "/catalogue" });
    await adminOnly.register(adminProjectsRoutes, { prefix: "/projects" });
    await adminOnly.register(adminCategoriesRoutes, { prefix: "/categories" });
    await adminOnly.register(adminPartiesRoutes, { prefix: "/parties" });
    await adminOnly.register(adminGalleryRoutes, { prefix: "/gallery" });
    await adminOnly.register(adminSettingsRoutes, { prefix: "/settings" });
    await adminOnly.register(adminUsersRoutes, { prefix: "/users" });
  });
}
