import type { FastifyInstance } from "fastify";
import adminCategoriesRoutes from "./categories.routes.js";
import adminMeRoutes from "./me.routes.js";
import adminProjectsRoutes from "./projects.routes.js";
import adminSettingsRoutes from "./settings.routes.js";

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  await app.register(adminMeRoutes);
  await app.register(adminProjectsRoutes, { prefix: "/projects" });
  await app.register(adminCategoriesRoutes, { prefix: "/categories" });
  await app.register(adminSettingsRoutes, { prefix: "/settings" });
}
