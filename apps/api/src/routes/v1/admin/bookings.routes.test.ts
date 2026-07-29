import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerErrorHandler } from "../../../plugins/error-handler.js";
import { AppError } from "../../../lib/errors.js";
import adminBookingsRoutes from "./bookings.routes.js";

describe("admin party workflow routes", () => {
  async function appWith(workflow: Record<string, unknown>) {
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("user", null as never);
    app.addHook("onRequest", async (request) => {
      request.user = { sub: "10000000-0000-4000-8000-000000000001" } as never;
    });
    app.decorate("services", { adminBookings: workflow } as never);
    await app.register(adminBookingsRoutes, { prefix: "/bookings" });
    return app;
  }

  it("dispatches dedicated party acceptance", async () => {
    const acceptPartyTime = vi.fn(async () => ({ status: "awaiting_in_store_payment" }));
    const app = await appWith({ acceptPartyTime });
    try {
      const response = await app.inject({ method: "POST", url: "/bookings/booking-1/accept-party-time", payload: { expectedStatus: "time_proposed", operationId: "operation-1" } });
      expect(response.statusCode).toBe(200);
      expect(acceptPartyTime).toHaveBeenCalledWith("booking-1", { expectedStatus: "time_proposed", operationId: "operation-1" }, "10000000-0000-4000-8000-000000000001");
    } finally { await app.close(); }
  });

  it("rejects crafted expiry source statuses before dispatching the trusted expiry action", async () => {
    const expirePartyHold = vi.fn(async () => ({ status: "payment_expired" }));
    const app = await appWith({ expirePartyHold });
    try {
      const response = await app.inject({ method: "POST", url: "/bookings/booking-1/expire-party-hold", payload: { expectedStatus: "confirmed_paid", operationId: "operation-1" } });
      expect(response.statusCode).toBe(400);
      expect(expirePartyHold).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("returns the seven-day Melbourne calendar contract", async () => {
    const getCalendar = vi.fn(async () => ({
      from: "2026-07-30",
      to: "2026-08-05",
      timeZone: "Australia/Melbourne",
      days: [],
    }));
    const app = await appWith({ getCalendar });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/bookings/calendar?from=2026-07-30&to=2026-08-05",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.timeZone).toBe("Australia/Melbourne");
    } finally {
      await app.close();
    }
  });

  it("returns persisted policy acceptance metadata in list and detail payloads", async () => {
    const legacyAcceptance = new Date("2026-07-29T01:02:03.000Z");
    const currentAcceptance = new Date("2026-07-30T04:05:06.000Z");
    const list = vi.fn(async () => ({
      data: [
        {
          id: "legacy-booking",
          policyVersion: "2026-07-29",
          policyAcceptedAt: legacyAcceptance,
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    }));
    const getById = vi.fn(async () => ({
      id: "current-booking",
      policyVersion: "2026-07-30",
      policyAcceptedAt: currentAcceptance,
    }));
    const app = await appWith({ list, getById });
    try {
      const listResponse = await app.inject({ method: "GET", url: "/bookings" });
      const detailResponse = await app.inject({
        method: "GET",
        url: "/bookings/current-booking",
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().data.data).toEqual([
        {
          id: "legacy-booking",
          policyVersion: "2026-07-29",
          policyAcceptedAt: legacyAcceptance.toISOString(),
        },
      ]);
      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.json().data).toEqual({
        id: "current-booking",
        policyVersion: "2026-07-30",
        policyAcceptedAt: currentAcceptance.toISOString(),
      });
    } finally {
      await app.close();
    }
  });

  it("exposes canonical transition, charge, payment, and refund actions", async () => {
    const updateStatus = vi.fn(async () => ({ status: "confirmed" }));
    const recordPartyCharge = vi.fn(async () => ({ replayed: false }));
    const recordPartyPayment = vi.fn(async () => ({ status: "confirmed_paid" }));
    const recordPartyRefund = vi.fn(async () => ({ status: "refunded" }));
    const app = await appWith({
      updateStatus,
      recordPartyCharge,
      recordPartyPayment,
      recordPartyRefund,
    });
    try {
      const transition = await app.inject({
        method: "POST",
        url: "/bookings/booking-1/transitions",
        payload: {
          expectedStatus: "pending_review",
          toStatus: "confirmed",
          operationId: "operation-1",
          finalDate: "2026-08-01",
          finalStartTime: "10:00",
        },
      });
      const charge = await app.inject({
        method: "POST",
        url: "/bookings/booking-1/charges",
        payload: {
          expectedStatus: "confirmed_paid",
          operationId: "operation-2",
          type: "cake_cutting",
          amountCents: 1500,
        },
      });
      const payment = await app.inject({
        method: "POST",
        url: "/bookings/booking-1/payment",
        payload: {
          expectedStatus: "awaiting_in_store_payment",
          operationId: "operation-3",
          amountCents: 9500,
          paidAt: "2026-08-01T00:00:00.000Z",
        },
      });
      const refund = await app.inject({
        method: "POST",
        url: "/bookings/booking-1/refund",
        payload: {
          expectedStatus: "cancelled",
          operationId: "operation-4",
          refundedAt: "2026-08-01T00:00:00.000Z",
        },
      });

      expect([
        transition.statusCode,
        charge.statusCode,
        payment.statusCode,
        refund.statusCode,
      ]).toEqual([200, 200, 200, 200]);
    } finally {
      await app.close();
    }
  });

  it("returns the current status on a stale canonical action", async () => {
    const updateStatus = vi.fn(async () => {
      throw new AppError(
        409,
        "STATUS_CONFLICT",
        "The booking changed",
      );
    });
    const getById = vi.fn(async () => ({ status: "cancelled" }));
    const app = await appWith({ updateStatus, getById });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings/booking-1/transitions",
        payload: {
          expectedStatus: "pending_review",
          toStatus: "confirmed",
          operationId: "operation-1",
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("STALE_STATUS");
      expect(response.json().error.details).toEqual({
        currentStatus: "cancelled",
      });
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      method: "PATCH" as const,
      path: "/bookings/booking-1/status",
      service: "updateStatus",
      payload: {
        expectedStatus: "pending_review",
        toStatus: "confirmed",
        operationId: "operation-1",
      },
    },
    {
      method: "PATCH" as const,
      path: "/bookings/booking-1",
      service: "updateStatus",
      payload: {
        expectedStatus: "pending_review",
        toStatus: "confirmed",
        operationId: "operation-1",
      },
    },
    {
      method: "POST" as const,
      path: "/bookings/booking-1/propose-party-time",
      service: "proposePartyTime",
      payload: {
        expectedStatus: "pending_review",
        finalDate: "2026-08-01",
        finalGuestStart: "10:00",
        paymentDeadline: "2026-07-31T00:00:00.000Z",
        operationId: "operation-1",
      },
    },
    {
      method: "POST" as const,
      path: "/bookings/booking-1/record-party-payment",
      service: "recordPartyPayment",
      payload: {
        expectedStatus: "awaiting_in_store_payment",
        amountCents: 9500,
        paidAt: "2026-08-01T00:00:00.000Z",
        operationId: "operation-1",
      },
    },
    {
      method: "POST" as const,
      path: "/bookings/booking-1/accept-party-time",
      service: "acceptPartyTime",
      payload: {
        expectedStatus: "time_proposed",
        operationId: "operation-1",
      },
    },
    {
      method: "POST" as const,
      path: "/bookings/booking-1/expire-party-hold",
      service: "expirePartyHold",
      payload: {
        expectedStatus: "awaiting_in_store_payment",
        operationId: "operation-1",
      },
    },
    {
      method: "POST" as const,
      path: "/bookings/booking-1/record-party-charge",
      service: "recordPartyCharge",
      payload: {
        expectedStatus: "confirmed_paid",
        operationId: "operation-1",
        type: "cleaning",
        amountCents: 1500,
      },
    },
    {
      method: "POST" as const,
      path: "/bookings/booking-1/record-party-refund",
      service: "recordPartyRefund",
      payload: {
        expectedStatus: "cancelled",
        refundedAt: "2026-08-01T00:00:00.000Z",
        operationId: "operation-1",
      },
    },
  ])(
    "normalizes stale conflicts from legacy $path",
    async ({ method, path, service, payload }) => {
      const workflow = {
        [service]: vi.fn(async () => {
          throw new AppError(409, "STATUS_CONFLICT", "The booking changed");
        }),
        getById: vi.fn(async () => ({ status: "cancelled" })),
      };
      const app = await appWith(workflow);
      try {
        const response = await app.inject({
          method,
          url: path,
          payload,
        });
        expect(response.statusCode).toBe(409);
        expect(response.json().error).toMatchObject({
          code: "STALE_STATUS",
          details: { currentStatus: "cancelled" },
        });
      } finally {
        await app.close();
      }
    },
  );
});
