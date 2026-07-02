import type { FastifyInstance } from "fastify";
import { success } from "../../../../lib/response.js";

export interface AdminCrudService {
  list(): Promise<unknown>;
  getById(id: string): Promise<unknown>;
  create(data: unknown): Promise<unknown>;
  update(id: string, data: unknown): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

/** Registers standard admin CRUD routes: GET /, GET /:id, POST /, PATCH /:id, DELETE /:id.
 *  Use only when the service exactly matches the standard shape. */
export function registerAdminCrudRoutes(
  app: FastifyInstance,
  service: AdminCrudService,
) {
  app.get("/", async () => success(await service.list()));
  app.get("/:id", async (req: any) => success(await service.getById(req.params.id)));
  app.post("/", async (req: any) => success(await service.create(req.body)));
  app.patch("/:id", async (req: any) => success(await service.update(req.params.id, req.body)));
  app.delete("/:id", async (req: any) => success(await service.delete(req.params.id)));
}
