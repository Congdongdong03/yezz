import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import adminRoutes from "./index.js";

describe("admin durable rate limits", () => {
  it("keys authenticated admin reads by user ID rather than IP", async () => {
    const consume = vi.fn(async () => ({
      allowed: false,
      limit: 300,
      remaining: 0,
      resetAt: new Date("2026-07-28T10:00:00.000Z"),
      resetAfter: 77,
      retryAfter: 77,
    }));
    const app = Fastify();
    app.decorateRequest("user", null as never);
    app.decorate("authenticate", async (request) => {
      request.user = {
        sub: "00000000-0000-4000-8000-000000000099",
        email: "staff@example.test",
        role: "staff",
        sessionVersion: 0,
      };
    });
    app.decorate("requireAdmin", async () => undefined);
    app.decorate("services", {
      rateLimits: { consume },
    } as never);
    await app.register(adminRoutes, { prefix: "/admin" });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/admin/me",
        remoteAddress: "198.51.100.203",
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("77");
      expect(consume).toHaveBeenCalledWith(
        "admin-read",
        "00000000-0000-4000-8000-000000000099",
        300,
        3600,
      );
    } finally {
      await app.close();
    }
  });

  it("applies the upload scope to the full production route prefix", async () => {
    const consume = vi.fn(async () => ({
      allowed: false,
      limit: 50,
      remaining: 0,
      resetAt: new Date("2026-07-28T10:00:00.000Z"),
      resetAfter: 77,
      retryAfter: 77,
    }));
    const app = Fastify();
    app.decorateRequest("user", null as never);
    app.decorate("authenticate", async (request) => {
      request.user = {
        sub: "00000000-0000-4000-8000-000000000099",
        email: "staff@example.test",
        role: "staff",
        sessionVersion: 0,
      };
    });
    app.decorate("requireAdmin", async () => undefined);
    app.decorate("services", {
      rateLimits: { consume },
    } as never);
    await app.register(
      async (v1) => {
        await v1.register(adminRoutes, { prefix: "/admin" });
      },
      { prefix: "/api/v1" },
    );

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/upload",
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["ratelimit-limit"]).toBe("50");
      expect(consume).toHaveBeenCalledWith(
        "admin-upload",
        "00000000-0000-4000-8000-000000000099",
        50,
        3600,
      );
    } finally {
      await app.close();
    }
  });
});
