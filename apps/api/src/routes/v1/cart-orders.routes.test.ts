import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import cartOrdersRoutes from "./cart-orders.routes.js";

describe("cartOrdersRoutes durable rate limits", () => {
  it("keys cart-order creation by the verified signed client IP", async () => {
    const consume = vi.fn(async () => ({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: new Date("2026-07-28T10:00:00.000Z"),
      resetAfter: 60,
    }));
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = {
        clientIp: "203.0.113.11",
        requestId: "00000000-0000-4000-8000-000000000001",
        timestamp: 1_785_200_000,
        idempotencyKey: null,
      };
    });
    app.decorate("services", {
      rateLimits: { consume },
      cartOrders: {
        async create() {
          return { id: "order-1", status: "new" };
        },
      },
    } as never);
    await app.register(cartOrdersRoutes, { prefix: "/cart-orders" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/cart-orders",
        remoteAddress: "198.51.100.201",
        payload: { name: "Alice", phone: "123", items: [] },
      });

      expect(response.statusCode).toBe(201);
      expect(consume).toHaveBeenCalledWith(
        "cart-order",
        "203.0.113.11",
        5,
        3600,
      );
    } finally {
      await app.close();
    }
  });
});
