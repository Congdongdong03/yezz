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
    contactedCustomer?: boolean;
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

  app.post<{ Params: { id: string }; Body: { expectedStatus: "pending_review"; finalDate: string; finalGuestStart: string; paymentDeadline: string; operationId: string } }>("/:id/propose-party-time", async (request) => {
    return success(await app.services.adminBookings.proposePartyTime(request.params.id, {
      ...request.body,
      paymentDeadline: new Date(request.body.paymentDeadline),
    }, request.user.sub));
  });

  app.post<{ Params: { id: string }; Body: { expectedStatus: "awaiting_in_store_payment"; amountCents: 9500 | 14500; paidAt: string; operationId: string } }>("/:id/record-party-payment", async (request) => {
    return success(await app.services.adminBookings.recordPartyPayment(request.params.id, {
      ...request.body,
      paidAt: new Date(request.body.paidAt),
    }, request.user.sub));
  });

  app.post<{ Params: { id: string }; Body: { type: "cake_cutting" | "cleaning" | "overtime"; amountCents: number; note?: string } }>("/:id/record-party-charge", async (request) => {
    await app.services.adminBookings.recordPartyCharge(request.params.id, request.body, request.user.sub);
    return success({ recorded: true });
  });

  app.post<{ Params: { id: string }; Body: { expectedStatus: "cancelled"; refundedAt: string; operationId: string } }>("/:id/record-party-refund", async (request) => {
    return success(await app.services.adminBookings.recordPartyRefund(request.params.id, {
      ...request.body,
      refundedAt: new Date(request.body.refundedAt),
    }, request.user.sub));
  });
}
