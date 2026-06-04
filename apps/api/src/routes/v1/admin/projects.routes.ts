import type { FastifyInstance } from "fastify";
import type {
  ProjectCreateInput,
  ProjectUpdateInput,
} from "../../../repositories/projects.repository.js";
import { success } from "../../../lib/response.js";

export default async function adminProjectsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { page?: string; limit?: string } }>("/", async (request) => {
    const page = request.query.page ? Number(request.query.page) : undefined;
    const limit = request.query.limit ? Number(request.query.limit) : undefined;
    const data = await app.services.adminProjects.list({ page, limit });
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminProjects.getById(request.params.id);
    return success(data);
  });

  app.post<{ Body: ProjectCreateInput }>("/", async (request) => {
    const data = await app.services.adminProjects.create(request.body);
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: ProjectUpdateInput }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminProjects.update(
        request.params.id,
        request.body,
      );
      return success(data);
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminProjects.delete(request.params.id);
    return success(data);
  });
}
