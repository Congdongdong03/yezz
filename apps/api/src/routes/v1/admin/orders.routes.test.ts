import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import adminOrdersRoutes from "./orders.routes.js";

describe("admin cart-order status routes", () => {
  it("forwards compare-and-set identity and the authenticated actor", async () => {
    const updateStatus = vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000001",
      status: "confirmed",
      replayed: false,
    }));
    const app = Fastify();
    app.decorateRequest("user", null as never);
    app.addHook("onRequest", async (request) => {
      request.user = {
        sub: "00000000-0000-4000-8000-000000000002",
        email: "staff@example.com",
        role: "staff",
        sessionVersion: 0,
      };
    });
    app.decorate("services", {
      adminCartOrders: {
        list: vi.fn(),
        getById: vi.fn(),
        updateStatus,
      },
    } as never);
    await app.register(adminOrdersRoutes, { prefix: "/orders" });

    try {
      const payload = {
        status: "confirmed",
        expectedStatus: "contacted",
        operationId: "00000000-0000-4000-8000-000000000003",
        note: "Confirmed by phone",
      };
      const response = await app.inject({
        method: "PATCH",
        url: "/orders/00000000-0000-4000-8000-000000000001/status",
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(updateStatus).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000001",
        payload,
        "00000000-0000-4000-8000-000000000002",
      );
    } finally {
      await app.close();
    }
  });
});
