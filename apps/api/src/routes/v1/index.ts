import type { FastifyInstance } from "fastify";
import adminRoutes from "./admin/index.js";
import authRoutes from "./auth.routes.js";
import bookingsRoutes from "./bookings.routes.js";
import cartOrdersRoutes from "./cart-orders.routes.js";
import categoriesRoutes from "./categories.routes.js";
import galleryRoutes from "./gallery.routes.js";
import partiesRoutes from "./parties.routes.js";
import projectsRoutes from "./projects.routes.js";
import settingsRoutes from "./settings.routes.js";

export default async function v1Routes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(bookingsRoutes, { prefix: "/bookings" });
  await app.register(cartOrdersRoutes, { prefix: "/cart-orders" });
  await app.register(categoriesRoutes, { prefix: "/categories" });
  await app.register(projectsRoutes, { prefix: "/projects" });
  await app.register(partiesRoutes, { prefix: "/parties" });
  await app.register(galleryRoutes, { prefix: "/gallery" });
  await app.register(settingsRoutes, { prefix: "/settings" });
  await app.register(adminRoutes, { prefix: "/admin" });
}
