import type { FastifyInstance } from "fastify";
import type { OrderStatus } from "../../../repositories/cart-orders.repository.js";
import { success } from "../../../lib/response.js";

export default async function adminOrdersRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminCartOrders.list();
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminCartOrders.getById(request.params.id);
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: { status: OrderStatus } }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminCartOrders.updateStatus(
        request.params.id,
        request.body.status,
      );
      return success(data);
    },
  );
}
