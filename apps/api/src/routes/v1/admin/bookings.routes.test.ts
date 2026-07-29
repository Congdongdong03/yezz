import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerErrorHandler } from "../../../plugins/error-handler.js";
import adminBookingsRoutes from "./bookings.routes.js";

describe("admin party workflow routes", () => {
  async function appWith(workflow: { acceptPartyTime?: ReturnType<typeof vi.fn>; expirePartyHold?: ReturnType<typeof vi.fn> }) {
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
});
