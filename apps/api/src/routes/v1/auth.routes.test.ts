import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { describe, expect, it, vi } from "vitest";
import authRoutes from "./auth.routes.js";

function rateLimitResult(
  allowed: boolean,
  limit: number,
  remaining: number,
  retryAfter?: number,
) {
  return {
    allowed,
    limit,
    remaining,
    resetAt: new Date("2026-07-28T10:00:00.000Z"),
    resetAfter: retryAfter ?? 60,
    ...(retryAfter === undefined ? {} : { retryAfter }),
  };
}

describe("authRoutes durable rate limits", () => {
  it("consumes both login IP/email and IP buckets using signed identity", async () => {
    const consume = vi.fn(
      async (_scope: string, _subject: string, limit: number) =>
        rateLimitResult(true, limit, limit - 1),
    );
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = {
        clientIp: "203.0.113.12",
        requestId: "00000000-0000-4000-8000-000000000001",
        timestamp: 1_785_200_000,
        idempotencyKey: null,
      };
    });
    app.decorate("services", {
      rateLimits: { consume },
      auth: {
        async login() {
          return {
            token: "token",
            user: { id: "user-1", email: "alice@example.com" },
          };
        },
      },
    } as never);
    app.decorate("jwt", {
      sign: vi.fn(() => "token"),
    } as never);
    await app.register(cookie);
    await app.register(authRoutes, { prefix: "/auth" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        remoteAddress: "198.51.100.202",
        payload: {
          email: "  Alice@Example.COM ",
          password: "password",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(consume).toHaveBeenCalledTimes(2);
      expect(consume).toHaveBeenCalledWith(
        "login-ip-email",
        "203.0.113.12\nalice@example.com",
        5,
        3600,
      );
      expect(consume).toHaveBeenCalledWith(
        "login-ip",
        "203.0.113.12",
        30,
        3600,
      );
    } finally {
      await app.close();
    }
  });

  it("blocks authentication when either login bucket is exhausted", async () => {
    const login = vi.fn();
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = {
        clientIp: "203.0.113.12",
        requestId: "00000000-0000-4000-8000-000000000001",
        timestamp: 1_785_200_000,
        idempotencyKey: null,
      };
    });
    app.decorate("services", {
      rateLimits: {
        async consume(scope: string) {
          return scope === "login-ip-email"
            ? rateLimitResult(false, 5, 0, 45)
            : rateLimitResult(true, 30, 29);
        },
      },
      auth: { login },
    } as never);
    await app.register(cookie);
    await app.register(authRoutes, { prefix: "/auth" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "alice@example.com", password: "password" },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("45");
      expect(login).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
