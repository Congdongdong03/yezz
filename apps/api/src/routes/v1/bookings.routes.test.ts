import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import bookingsRoutes from "./bookings.routes.js";

const VERIFIED_IDENTITY = {
  clientIp: "203.0.113.10",
  requestId: "00000000-0000-4000-8000-000000000001",
  timestamp: 1_785_200_000,
  idempotencyKey: null,
};

function allowedResult() {
  return {
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: new Date("2026-07-28T10:00:00.000Z"),
    resetAfter: 60,
  };
}

describe("bookingsRoutes durable rate limits", () => {
  it("keys booking creation by the verified signed client IP", async () => {
    const consume = vi.fn(async () => allowedResult());
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume },
      bookings: {
        async create() {
          return {
            id: "booking-1",
            status: "new",
            createdAt: new Date("2026-07-28T00:00:00.000Z"),
          };
        },
      },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        remoteAddress: "198.51.100.200",
        headers: {
          "idempotency-key": "00000000-0000-4000-8000-000000000010",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(201);
      expect(consume).toHaveBeenCalledWith("booking", "203.0.113.10", 5, 3600);
      expect(response.headers["ratelimit-remaining"]).toBe("4");
    } finally {
      await app.close();
    }
  });

  it("returns exact Retry-After metadata without creating a booking", async () => {
    const create = vi.fn();
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: {
        async consume() {
          return {
            allowed: false,
            limit: 5,
            remaining: 0,
            resetAt: new Date("2026-07-28T10:00:00.000Z"),
            resetAfter: 1234,
            retryAfter: 1234,
          };
        },
      },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: {
          "idempotency-key": "00000000-0000-4000-8000-000000000011",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("1234");
      expect(response.headers["ratelimit-remaining"]).toBe("0");
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("fails closed with 503 when durable limiting is unavailable", async () => {
    const create = vi.fn();
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: {
        async consume() {
          throw new AppError(
            503,
            "RATE_LIMIT_UNAVAILABLE",
            "Please try again shortly.",
          );
        },
      },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: {
          "idempotency-key": "00000000-0000-4000-8000-000000000012",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(503);
      expect(create).not.toHaveBeenCalled();
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
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume: vi.fn(async () => allowedResult()) },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        ...(key ? { headers: { "idempotency-key": key } } : {}),
        payload: { name: "Alice", phone: "123" },
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
      id: "booking-1",
      status: "new",
      replayed: true,
      notification: "queued",
    }));
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume: vi.fn(async () => allowedResult()) },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: {
          "idempotency-key": "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        data: { id: "booking-1", replayed: true },
      });
      expect(create).toHaveBeenCalledWith(
        { name: "Alice", phone: "123" },
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      );
    } finally {
      await app.close();
    }
  });
});
