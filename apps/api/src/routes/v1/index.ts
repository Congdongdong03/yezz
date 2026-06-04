import type { FastifyInstance } from "fastify";
import adminRoutes from "./admin/index.js";
import authRoutes from "./auth.routes.js";
import categoriesRoutes from "./categories.routes.js";
import projectsRoutes from "./projects.routes.js";
import settingsRoutes from "./settings.routes.js";

export default async function v1Routes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(categoriesRoutes, { prefix: "/categories" });
  await app.register(projectsRoutes, { prefix: "/projects" });
  await app.register(settingsRoutes, { prefix: "/settings" });
  await app.register(adminRoutes, { prefix: "/admin" });
}
