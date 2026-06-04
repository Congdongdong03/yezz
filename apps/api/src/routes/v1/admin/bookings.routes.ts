import type { FastifyInstance } from "fastify";
import type { OrderStatus } from "../../../services/admin/bookings.admin.service.js";
import { success } from "../../../lib/response.js";

export default async function adminBookingsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminBookings.list();
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminBookings.getById(request.params.id);
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: { status: OrderStatus } }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminBookings.updateStatus(
        request.params.id,
        request.body.status,
      );
      return success(data);
    },
  );
}
