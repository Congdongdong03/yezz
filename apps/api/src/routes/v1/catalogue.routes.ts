import type { FastifyInstance } from "fastify";
import { success } from "../../lib/response.js";

export default async function catalogueRoutes(app: FastifyInstance) {
  app.get("/", async () => success(await app.services.catalogue.list()));

  app.get<{ Params: { slug: string } }>("/:slug", async (request) =>
    success(await app.services.catalogue.getBySlug(request.params.slug)),
  );
}
