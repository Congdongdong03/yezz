import type { FastifyInstance } from "fastify";
import type { OrderStatus } from "../../../services/admin/bookings.admin.service.js";
import { success } from "../../../lib/response.js";
import { parsePositiveInt } from "../../../lib/validation.js";

export default async function adminBookingsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { page?: string; limit?: string; status?: OrderStatus } }>("/", async (request) => {
    const data = await app.services.adminBookings.list({
      page: request.query.page ? parsePositiveInt(request.query.page, 1) : undefined,
      limit: request.query.limit ? parsePositiveInt(request.query.limit, 100) : undefined,
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
