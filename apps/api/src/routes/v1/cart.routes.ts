import type { FastifyInstance } from "fastify";
import type { CartSessionItem } from "@yezz/db";
import { success } from "../../lib/response.js";

export default async function cartRoutes(app: FastifyInstance) {
  app.get<{ Params: { sessionId: string } }>("/:sessionId", async (request) => {
    const data = await app.services.cartSessions.get(request.params.sessionId);
    return success(data);
  });

  app.put<{ Params: { sessionId: string }; Body: { items?: CartSessionItem[] } }>(
    "/:sessionId",
    async (request) => {
      const items = request.body?.items ?? [];
      const data = await app.services.cartSessions.save(request.params.sessionId, items);
      return success(data);
    },
  );
}
