import Fastify from "fastify";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import cartOrdersRoutes from "./cart-orders.routes.js";

describe("cartOrdersRoutes durable rate limits", () => {
  beforeEach(() => {
    vi.stubEnv("REQUEST_FLOW_PRODUCT_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["absent", undefined],
    ["malformed", "TRUE"],
  ])(
    "rejects an %s product flag before durable rate limiting",
    async (_label, productFlag) => {
      if (productFlag === undefined) {
        delete process.env.REQUEST_FLOW_PRODUCT_ENABLED;
      } else {
        vi.stubEnv("REQUEST_FLOW_PRODUCT_ENABLED", productFlag);
      }
      const consume = vi.fn();
      const create = vi.fn();
      const app = Fastify();
      registerErrorHandler(app);
      app.decorateRequest("verifiedClientIdentity", null);
      app.decorate("services", {
        rateLimits: { consume },
        cartOrders: { create },
      } as never);
      await app.register(cartOrdersRoutes, {
        prefix: "/cart-orders",
      });

      try {
        const response = await app.inject({
          method: "POST",
          url: "/cart-orders",
          headers: {
            "idempotency-key":
              "00000000-0000-4000-8000-000000000019",
          },
          payload: {
            name: "Alice",
            phone: "123",
            items: [],
          },
        });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
          success: false,
          error: { code: "REQUEST_FLOW_DISABLED" },
        });
        expect(consume).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );

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
        headers: {
          "idempotency-key": "00000000-0000-4000-8000-000000000020",
        },
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

  it.each([
    ["missing", undefined],
    ["malformed", "not-a-uuid"],
  ])("rejects a %s Idempotency-Key before create", async (_label, key) => {
    const create = vi.fn();
    const app = Fastify();
    registerErrorHandler(app);
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
      rateLimits: {
        consume: vi.fn(async () => ({
          allowed: true,
          limit: 5,
          remaining: 4,
          resetAt: new Date("2026-07-28T10:00:00.000Z"),
          resetAfter: 60,
        })),
      },
      cartOrders: { create },
    } as never);
    await app.register(cartOrdersRoutes, { prefix: "/cart-orders" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/cart-orders",
        ...(key ? { headers: { "idempotency-key": key } } : {}),
        payload: { name: "Alice", phone: "123", items: [] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("keeps HTTP 201 for an identical replay and forwards the normalized key", async () => {
    const create = vi.fn(async () => ({
      id: "order-1",
      status: "new",
      replayed: true,
      notification: "queued",
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
      rateLimits: {
        consume: vi.fn(async () => ({
          allowed: true,
          limit: 5,
          remaining: 4,
          resetAt: new Date("2026-07-28T10:00:00.000Z"),
          resetAfter: 60,
        })),
      },
      cartOrders: { create },
    } as never);
    await app.register(cartOrdersRoutes, { prefix: "/cart-orders" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/cart-orders",
        headers: {
          "idempotency-key": "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB",
        },
        payload: { name: "Alice", phone: "123", items: [] },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        data: { id: "order-1", replayed: true },
      });
      expect(create).toHaveBeenCalledWith(
        { name: "Alice", phone: "123", items: [] },
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      );
    } finally {
      await app.close();
    }
  });
});
