import type { FastifyInstance } from "fastify";
import type { OrderStatus } from "../../../services/admin/bookings.admin.service.js";
import { success } from "../../../lib/response.js";

export default async function adminBookingsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { page?: string; limit?: string; status?: OrderStatus } }>("/", async (request) => {
    const data = await app.services.adminBookings.list({
      page: request.query.page ? Number(request.query.page) : undefined,
      limit: request.query.limit ? Number(request.query.limit) : undefined,
      status: request.query.status,
    });
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminBookings.getById(request.params.id);
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: { status: OrderStatus; note?: string } }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminBookings.updateStatus(
        request.params.id,
        request.body.status,
        request.body.note,
      );
      return success(data);
    },
  );
}
