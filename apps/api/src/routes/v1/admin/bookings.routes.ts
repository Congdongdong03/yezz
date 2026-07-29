import type { FastifyInstance } from "fastify";
import type { BookingStatus } from "@yezz/db";
import type { OrderStatus } from "../../../services/admin/bookings.admin.service.js";
import { success } from "../../../lib/response.js";
import { parseAdminQueueQuery } from "../../../lib/admin-queue-query.js";
import { AppError, isAppError } from "../../../lib/errors.js";

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

  app.get<{
    Querystring: { from: string; to: string };
  }>("/calendar", async (request) => {
    return success(
      await app.services.adminBookings.getCalendar(
        request.query.from,
        request.query.to,
      ),
    );
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

  function requireOperation(input: {
    expectedStatus?: string;
    operationId?: string;
  }) {
    if (!input?.expectedStatus || !input.operationId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "expectedStatus and operationId are required",
      );
    }
  }

  async function safeWrite<T>(
    id: string,
    actorUserId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isAppError(error) && error.statusCode === 409) {
        const current = await app.services.adminBookings.getById(
          id,
          actorUserId,
        );
        throw new AppError(
          error.statusCode,
          error.code === "STATUS_CONFLICT" ? "STALE_STATUS" : error.code,
          error.message,
          {
          ...error.details,
          currentStatus: current.status,
          },
        );
      }
      throw error;
    }
  }

  type TransitionBody = StatusBody & {
    action?: "transition" | "propose_party_time" | "accept_party_time";
    finalDate?: string;
    finalGuestStart?: string;
    paymentDeadline?: string;
  };

  app.post<{ Params: { id: string }; Body: TransitionBody }>(
    "/:id/transitions",
    async (request) => {
      requireOperation(request.body);
      return success(
        await safeWrite(
          request.params.id,
          request.user.sub,
          async () => {
            if (request.body.action === "propose_party_time") {
              if (
                request.body.expectedStatus !== "pending_review" ||
                !request.body.finalDate ||
                !request.body.finalGuestStart ||
                !request.body.paymentDeadline
              ) {
                throw new AppError(
                  400,
                  "VALIDATION_ERROR",
                  "party proposal date, start, and payment deadline are required",
                );
              }
              return app.services.adminBookings.proposePartyTime(
                request.params.id,
                {
                  expectedStatus: "pending_review",
                  finalDate: request.body.finalDate,
                  finalGuestStart: request.body.finalGuestStart,
                  paymentDeadline: new Date(request.body.paymentDeadline),
                  operationId: request.body.operationId,
                },
                request.user.sub,
              );
            }
            if (request.body.action === "accept_party_time") {
              if (request.body.expectedStatus !== "time_proposed") {
                throw new AppError(
                  400,
                  "VALIDATION_ERROR",
                  "party acceptance requires time_proposed",
                );
              }
              return app.services.adminBookings.acceptPartyTime(
                request.params.id,
                {
                  expectedStatus: "time_proposed",
                  operationId: request.body.operationId,
                },
                request.user.sub,
              );
            }
            return app.services.adminBookings.updateStatus(
              request.params.id,
              request.body,
              request.user.sub,
            );
          },
        ),
      );
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      expectedStatus: "confirmed_paid";
      operationId: string;
      type: "cake_cutting" | "cleaning" | "overtime";
      amountCents: number;
      note?: string;
    };
  }>("/:id/charges", async (request) => {
    requireOperation(request.body);
    return success(
      await safeWrite(request.params.id, request.user.sub, () =>
        app.services.adminBookings.recordPartyCharge(
          request.params.id,
          request.body,
          request.user.sub,
        ),
      ),
    );
  });

  app.post<{
    Params: { id: string };
    Body: {
      expectedStatus: "awaiting_in_store_payment";
      operationId: string;
      amountCents: 9500 | 14500;
      paidAt: string;
    };
  }>("/:id/payment", async (request) => {
    requireOperation(request.body);
    return success(
      await safeWrite(request.params.id, request.user.sub, () =>
        app.services.adminBookings.recordPartyPayment(
          request.params.id,
          { ...request.body, paidAt: new Date(request.body.paidAt) },
          request.user.sub,
        ),
      ),
    );
  });

  app.post<{
    Params: { id: string };
    Body: {
      expectedStatus: "cancelled";
      operationId: string;
      refundedAt: string;
    };
  }>("/:id/refund", async (request) => {
    requireOperation(request.body);
    return success(
      await safeWrite(request.params.id, request.user.sub, () =>
        app.services.adminBookings.recordPartyRefund(
          request.params.id,
          { ...request.body, refundedAt: new Date(request.body.refundedAt) },
          request.user.sub,
        ),
      ),
    );
  });

  const updateStatus = async (
    request: {
      params: { id: string };
      body: StatusBody;
      user: { sub: string };
    },
  ) => {
    requireOperation(request.body);
    const data = await safeWrite(
      request.params.id,
      request.user.sub,
      () =>
        app.services.adminBookings.updateStatus(
          request.params.id,
          request.body,
          request.user.sub,
        ),
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
    requireOperation(request.body);
    return success(await safeWrite(request.params.id, request.user.sub, () =>
      app.services.adminBookings.proposePartyTime(request.params.id, {
        ...request.body,
        paymentDeadline: new Date(request.body.paymentDeadline),
      }, request.user.sub),
    ));
  });

  app.post<{ Params: { id: string }; Body: { expectedStatus: "awaiting_in_store_payment"; amountCents: 9500 | 14500; paidAt: string; operationId: string } }>("/:id/record-party-payment", async (request) => {
    requireOperation(request.body);
    return success(await safeWrite(request.params.id, request.user.sub, () =>
      app.services.adminBookings.recordPartyPayment(request.params.id, {
        ...request.body,
        paidAt: new Date(request.body.paidAt),
      }, request.user.sub),
    ));
  });

  app.post<{ Params: { id: string }; Body: { expectedStatus: "time_proposed"; operationId: string } }>("/:id/accept-party-time", async (request) => {
    requireOperation(request.body);
    return success(await safeWrite(request.params.id, request.user.sub, () =>
      app.services.adminBookings.acceptPartyTime(request.params.id, request.body, request.user.sub),
    ));
  });

  app.post<{ Params: { id: string }; Body: { expectedStatus: "awaiting_in_store_payment"; operationId: string } }>("/:id/expire-party-hold", async (request) => {
    requireOperation(request.body);
    if (request.body.expectedStatus !== "awaiting_in_store_payment") {
      throw new AppError(400, "VALIDATION_ERROR", "expectedStatus must be awaiting_in_store_payment");
    }
    return success(await safeWrite(request.params.id, request.user.sub, () =>
      app.services.adminBookings.expirePartyHold(request.params.id, request.body, request.user.sub),
    ));
  });

  app.post<{ Params: { id: string }; Body: { expectedStatus: "confirmed_paid"; operationId: string; type: "cake_cutting" | "cleaning" | "overtime"; amountCents: number; note?: string } }>("/:id/record-party-charge", async (request) => {
    requireOperation(request.body);
    return success(await safeWrite(request.params.id, request.user.sub, () =>
      app.services.adminBookings.recordPartyCharge(request.params.id, request.body, request.user.sub),
    ));
  });

  app.post<{ Params: { id: string }; Body: { expectedStatus: "cancelled"; refundedAt: string; operationId: string } }>("/:id/record-party-refund", async (request) => {
    requireOperation(request.body);
    return success(await safeWrite(request.params.id, request.user.sub, () =>
      app.services.adminBookings.recordPartyRefund(request.params.id, {
        ...request.body,
        refundedAt: new Date(request.body.refundedAt),
      }, request.user.sub),
    ));
  });
}
