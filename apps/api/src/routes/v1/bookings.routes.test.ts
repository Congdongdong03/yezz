import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";
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
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(503);
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
