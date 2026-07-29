import Fastify from "fastify";
import { cartOrders, requestRateLimits, siteSettings } from "@yezz/db";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import { AppError } from "../../lib/errors.js";
import cartOrdersRoutes from "./cart-orders.routes.js";
import { createRequestFlowTestDatabase, type RequestFlowTestDatabase } from "../../test-utils/request-flow-postgres.js";
import { createRateLimitsRepository } from "../../repositories/rate-limits.repository.js";
import { createRateLimitsService } from "../../services/rate-limits.service.js";
import { createSettingsService } from "../../services/settings.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

const productDisabledSettings = {
  async requirePublicRequestCapability() {
    throw new AppError(
      503,
      "REQUEST_FLOW_DISABLED",
      "product requests are not currently available",
    );
  },
};

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
        settings: productDisabledSettings,
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

  it("keeps product disabled before considering the verified client IP limiter", async () => {
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
      settings: productDisabledSettings,
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

      expect(response.statusCode).toBe(503);
      expect(consume).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each([
    ["missing", undefined],
    ["malformed", "not-a-uuid"],
  ])("keeps product disabled before validating a %s Idempotency-Key", async (_label, key) => {
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
      settings: productDisabledSettings,
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

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "REQUEST_FLOW_DISABLED" },
      });
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("keeps product disabled for an identical replay", async () => {
    const create = vi.fn(async () => ({
      id: "order-1",
      status: "new",
      replayed: true,
      notification: "queued",
    }));
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
      settings: productDisabledSettings,
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

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "REQUEST_FLOW_DISABLED" },
      });
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

describe.skipIf(!runDatabaseTests)("cart order product gate PostgreSQL integration", () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    await database.connection.db.insert(siteSettings).values({
      storeName: "YezYY",
      productRequestsEnabled: true,
    });
  });

  afterEach(async () => database.close());

  it("keeps product hard-disabled before durable limiting even when both flags are true", async () => {
    vi.stubEnv("REQUEST_FLOW_PRODUCT_ENABLED", "true");
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
      settings: createSettingsService(database.connection.db, null, {
        REQUEST_FLOW_PRODUCT_ENABLED: "true",
      }),
      rateLimits: createRateLimitsService(
        createRateLimitsRepository(database.connection.db),
        { hashSecret: "cart-product-gate-test-secret" },
      ),
      cartOrders: { create },
    } as never);
    await app.register(cartOrdersRoutes, { prefix: "/cart-orders" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/cart-orders",
        headers: { "idempotency-key": crypto.randomUUID() },
        payload: { name: "Product", phone: "0430000000", items: [] },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "REQUEST_FLOW_DISABLED" },
      });
      expect(create).not.toHaveBeenCalled();
      await expect(database.connection.db.select().from(requestRateLimits)).resolves.toHaveLength(0);
      await expect(database.connection.db.select().from(cartOrders)).resolves.toHaveLength(0);
    } finally {
      await app.close();
      vi.unstubAllEnvs();
    }
  });
});
