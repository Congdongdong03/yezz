import type { FastifyInstance } from "fastify";
import type { OrderStatus } from "../../../repositories/cart-orders.repository.js";
import { success } from "../../../lib/response.js";
import { parsePositiveInt } from "../../../lib/validation.js";

export default async function adminOrdersRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      page?: string;
      status?: OrderStatus;
      search?: string;
      unread?: string;
      overdue?: string;
      confirmedToday?: string;
    };
  }>("/", async (request) => {
    const data = await app.services.adminCartOrders.list({
      actorUserId: request.user.sub,
      page: request.query.page
        ? parsePositiveInt(request.query.page, 1)
        : undefined,
      status: request.query.status,
      search: request.query.search,
      unreadOnly: request.query.unread === "true",
      overdue: request.query.overdue === "true",
      confirmedToday: request.query.confirmedToday === "true",
    });
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminCartOrders.getById(
      request.params.id,
      request.user.sub,
    );
    return success(data);
  });

  type StatusBody = {
    status: OrderStatus;
    expectedStatus: OrderStatus;
    operationId: string;
    note?: string;
  };

  const updateStatus = async (request: {
    params: { id: string };
    body: StatusBody;
    user: { sub: string };
  }) => {
    const data = await app.services.adminCartOrders.updateStatus(
      request.params.id,
      request.body,
      request.user.sub,
    );
    return success(data);
  };

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    "/:id/status",
    async (request) => updateStatus(request),
  );

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    "/:id",
    async (request) => updateStatus(request),
  );
}
