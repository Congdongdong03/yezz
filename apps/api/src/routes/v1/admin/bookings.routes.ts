import type { FastifyInstance } from "fastify";
import type { BookingStatus } from "@yezz/db";
import type { OrderStatus } from "../../../services/admin/bookings.admin.service.js";
import { success } from "../../../lib/response.js";
import { parseAdminQueueQuery } from "../../../lib/admin-queue-query.js";

export default async function adminBookingsRoutes(app: FastifyInstance) {
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
    const data = await app.services.adminBookings.list({
      actorUserId: request.user.sub,
      ...parseAdminQueueQuery(request.query),
    });
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminBookings.getById(
      request.params.id,
      request.user.sub,
    );
    return success(data);
  });

  type StatusBody = {
    status?: OrderStatus;
    toStatus?: BookingStatus;
    expectedStatus: OrderStatus | BookingStatus;
    operationId: string;
    note?: string;
    newDate?: string;
    newStartTime?: string;
  };

  const updateStatus = async (
    request: {
      params: { id: string };
      body: StatusBody;
      user: { sub: string };
    },
  ) => {
    const data = await app.services.adminBookings.updateStatus(
      request.params.id,
      request.body,
      request.user.sub,
    );
    return success(data);
  };

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    "/:id/status",
    async (request) => {
      return updateStatus(request);
    },
  );

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    "/:id",
    async (request) => {
      return updateStatus(request);
    },
  );
}
