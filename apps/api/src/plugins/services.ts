import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createAdminBookingsService, type AdminBookingsService } from "../services/admin/bookings.admin.service.js";
import { createAdminCategoriesService, type AdminCategoriesService } from "../services/admin/categories.admin.service.js";
import { createAdminProjectsService, type AdminProjectsService } from "../services/admin/projects.admin.service.js";
import { createAdminGalleryService, type AdminGalleryService } from "../services/admin/gallery.admin.service.js";
import { createAdminPartiesService, type AdminPartiesService } from "../services/admin/parties.admin.service.js";
import { createAdminSettingsService, type AdminSettingsService } from "../services/admin/settings.admin.service.js";
import { createAdminUploadService, type AdminUploadService } from "../services/admin/upload.admin.service.js";
import { createAuthService, type AuthService } from "../services/auth.service.js";
import { createBookingsService, type BookingsService } from "../services/bookings.service.js";
import { createCartOrdersService, type CartOrdersService } from "../services/cart-orders.service.js";
import { createCategoriesService, type CategoriesService } from "../services/categories.service.js";
import { createGalleryService, type GalleryService } from "../services/gallery.service.js";
import { createPartiesService, type PartiesService } from "../services/parties.service.js";
import { createProjectsService, type ProjectsService } from "../services/projects.service.js";
import { createSettingsService, type SettingsService } from "../services/settings.service.js";

export type AppServices = {
  auth: AuthService;
  bookings: BookingsService;
  cartOrders: CartOrdersService;
  categories: CategoriesService;
  projects: ProjectsService;
  parties: PartiesService;
  gallery: GalleryService;
  settings: SettingsService;
  adminProjects: AdminProjectsService;
  adminBookings: AdminBookingsService;
  adminCategories: AdminCategoriesService;
  adminParties: AdminPartiesService;
  adminGallery: AdminGalleryService;
  adminSettings: AdminSettingsService;
  adminUpload: AdminUploadService;
};

declare module "fastify" {
  interface FastifyInstance {
    services: AppServices;
  }
}

export default fp(async (app: FastifyInstance) => {
  app.decorate("services", {
    auth: createAuthService(app.db),
    bookings: createBookingsService(app.db),
    cartOrders: createCartOrdersService(app.db),
    categories: createCategoriesService(app.db),
    projects: createProjectsService(app.db),
    parties: createPartiesService(app.db),
    gallery: createGalleryService(app.db),
    settings: createSettingsService(app.db),
    adminProjects: createAdminProjectsService(app.db),
    adminBookings: createAdminBookingsService(app.db),
    adminCategories: createAdminCategoriesService(app.db),
    adminParties: createAdminPartiesService(app.db),
    adminGallery: createAdminGalleryService(app.db),
    adminSettings: createAdminSettingsService(app.db),
    adminUpload: createAdminUploadService(app.db),
  });
});
