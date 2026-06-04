import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createAdminCategoriesService, type AdminCategoriesService } from "../services/admin/categories.admin.service.js";
import { createAdminProjectsService, type AdminProjectsService } from "../services/admin/projects.admin.service.js";
import { createAdminSettingsService, type AdminSettingsService } from "../services/admin/settings.admin.service.js";
import { createAuthService, type AuthService } from "../services/auth.service.js";
import { createCategoriesService, type CategoriesService } from "../services/categories.service.js";
import { createProjectsService, type ProjectsService } from "../services/projects.service.js";
import { createSettingsService, type SettingsService } from "../services/settings.service.js";

export type AppServices = {
  auth: AuthService;
  categories: CategoriesService;
  projects: ProjectsService;
  settings: SettingsService;
  adminProjects: AdminProjectsService;
  adminCategories: AdminCategoriesService;
  adminSettings: AdminSettingsService;
};

declare module "fastify" {
  interface FastifyInstance {
    services: AppServices;
  }
}

export default fp(async (app: FastifyInstance) => {
  app.decorate("services", {
    auth: createAuthService(app.db),
    categories: createCategoriesService(app.db),
    projects: createProjectsService(app.db),
    settings: createSettingsService(app.db),
    adminProjects: createAdminProjectsService(app.db),
    adminCategories: createAdminCategoriesService(app.db),
    adminSettings: createAdminSettingsService(app.db),
  });
});
