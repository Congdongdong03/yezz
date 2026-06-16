import type { FastifyInstance } from "fastify";
import { checkRateLimit } from "../../../lib/cache.js";
import { AppError } from "../../../lib/errors.js";
import adminBookingsRoutes from "./bookings.routes.js";
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

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;

    const method = request.method;
    const url = request.url.split("?")[0];
    const userId = request.user?.sub ?? request.ip;

    let limit: number;
    let keySuffix: string;

    if (method === "POST" && (url === "/upload" || url.startsWith("/upload/"))) {
      limit = 50;
      keySuffix = "upload";
    } else if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      limit = 200;
      keySuffix = "write";
    } else {
      limit = 300;
      keySuffix = "read";
    }

    const key = `admin:rl:${keySuffix}:${userId}`;
    const rl = await checkRateLimit(app.redis, key, limit, 3600);
    if (!rl.allowed) {
      reply.header("Retry-After", String(rl.retryAfter ?? 3600));
      throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
    }
  });

  await app.register(adminMeRoutes);
  await app.register(adminNotificationsRoutes, { prefix: "/notifications" });
  await app.register(adminBookingsRoutes, { prefix: "/bookings" });
  await app.register(adminOrdersRoutes, { prefix: "/orders" });
  await app.register(adminTimeSlotsRoutes, { prefix: "/time-slots" });
  await app.register(adminUploadRoutes, { prefix: "/upload" });

  await app.register(async (adminOnly) => {
    adminOnly.addHook("onRequest", app.requireAdmin);
    await adminOnly.register(adminProjectsRoutes, { prefix: "/projects" });
    await adminOnly.register(adminCategoriesRoutes, { prefix: "/categories" });
    await adminOnly.register(adminPartiesRoutes, { prefix: "/parties" });
    await adminOnly.register(adminGalleryRoutes, { prefix: "/gallery" });
    await adminOnly.register(adminSettingsRoutes, { prefix: "/settings" });
    await adminOnly.register(adminUsersRoutes, { prefix: "/users" });
  });
}
