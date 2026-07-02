import type { FastifyInstance } from "fastify";
import { registerAdminCrudRoutes } from "./lib/crud-route-factory.js";

export default async function adminGalleryRoutes(app: FastifyInstance) {
  registerAdminCrudRoutes(app, app.services.adminGallery);
}
