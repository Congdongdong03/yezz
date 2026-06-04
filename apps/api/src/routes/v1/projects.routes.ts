import type { FastifyInstance } from "fastify";
import { success } from "../../lib/response.js";

export default async function projectsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.projects.list();
    return success(data);
  });

  app.get<{ Params: { slug: string } }>("/:slug", async (request) => {
    const data = await app.services.projects.getBySlug(request.params.slug);
    return success(data);
  });
}
