import type { FastifyInstance } from "fastify";
import type { CategoryUpdateInput } from "../../../repositories/categories.repository.js";
import { success } from "../../../lib/response.js";

export default async function adminCategoriesRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminCategories.list();
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: CategoryUpdateInput }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminCategories.update(
        request.params.id,
        request.body,
      );
      return success(data);
    },
  );
}
