import type { FastifyInstance } from "fastify";
import { success } from "../../lib/response.js";

export default async function categoriesRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.categories.list();
    return success(data);
  });
}
