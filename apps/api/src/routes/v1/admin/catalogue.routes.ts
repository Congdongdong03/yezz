import type { FastifyInstance } from "fastify";
import { success } from "../../../lib/response.js";
import type { CatalogueAdminInput } from "../../../services/admin/catalogue.admin.service.js";

export default async function adminCatalogueRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminCatalogue.list();
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminCatalogue.getById(request.params.id);
    return success(data);
  });

  app.post<{ Body: CatalogueAdminInput }>("/", async (request) => {
    const data = await app.services.adminCatalogue.create(request.body);
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: CatalogueAdminInput }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminCatalogue.update(
        request.params.id,
        request.body,
      );
      return success(data);
    },
  );
}
