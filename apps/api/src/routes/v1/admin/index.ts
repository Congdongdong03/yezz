import type { FastifyInstance } from "fastify";
import adminBookingsRoutes from "./bookings.routes.js";
import adminOrdersRoutes from "./orders.routes.js";
import adminCategoriesRoutes from "./categories.routes.js";
import adminGalleryRoutes from "./gallery.routes.js";
import adminMeRoutes from "./me.routes.js";
import adminPartiesRoutes from "./parties.routes.js";
import adminProjectsRoutes from "./projects.routes.js";
import adminSettingsRoutes from "./settings.routes.js";
import adminUploadRoutes from "./upload.routes.js";

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  await app.register(adminMeRoutes);
  await app.register(adminUploadRoutes, { prefix: "/upload" });
  await app.register(adminProjectsRoutes, { prefix: "/projects" });
  await app.register(adminBookingsRoutes, { prefix: "/bookings" });
  await app.register(adminOrdersRoutes, { prefix: "/orders" });
  await app.register(adminCategoriesRoutes, { prefix: "/categories" });
  await app.register(adminPartiesRoutes, { prefix: "/parties" });
  await app.register(adminGalleryRoutes, { prefix: "/gallery" });
  await app.register(adminSettingsRoutes, { prefix: "/settings" });
}
