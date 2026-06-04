import type { FastifyInstance } from "fastify";
import type {
  PartyCreateInput,
  PartyUpdateInput,
} from "../../../repositories/parties.repository.js";
import { success } from "../../../lib/response.js";

export default async function adminPartiesRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminParties.list();
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminParties.getById(request.params.id);
    return success(data);
  });

  app.post<{ Body: PartyCreateInput }>("/", async (request) => {
    const data = await app.services.adminParties.create(request.body);
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: PartyUpdateInput }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminParties.update(
        request.params.id,
        request.body,
      );
      return success(data);
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminParties.delete(request.params.id);
    return success(data);
  });
}
