import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { describe, expect, it, vi } from "vitest";
import authRoutes from "./auth.routes.js";

function rateLimitResult(
  allowed: boolean,
  limit: number,
  remaining: number,
  retryAfter?: number,
  resetAfter = retryAfter ?? 60,
) {
  return {
    allowed,
    limit,
    remaining,
    resetAt: new Date("2026-07-28T10:00:00.000Z"),
    resetAfter,
    ...(retryAfter === undefined ? {} : { retryAfter }),
  };
}

describe("authRoutes durable rate limits", () => {
  it("completes password setup without authenticating or echoing the token", async () => {
    const complete = vi.fn(async () => ({ ok: true as const }));
    const consume = vi.fn(async (_scope: string, _subject: string, limit: number) =>
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
      passwordSetup: { complete },
    } as never);
    await app.register(cookie);
    await app.register(authRoutes, { prefix: "/auth" });
    const token = "A".repeat(43);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/setup-password",
        payload: { token, newPassword: "NewOwnerPassword42!" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, data: { ok: true } });
      expect(response.body).not.toContain(token);
      expect(complete).toHaveBeenCalledWith(token, "NewOwnerPassword42!");
      expect(consume).toHaveBeenCalledWith(
        "password-setup-ip",
        "203.0.113.12",
        10,
        3600,
      );
    } finally {
      await app.close();
    }
  });

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

  it("uses the longer retry delay when both login buckets are exhausted", async () => {
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
            : rateLimitResult(false, 30, 0, 90);
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
      expect(response.headers["ratelimit-limit"]).toBe("30");
      expect(response.headers["retry-after"]).toBe("90");
      expect(login).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("emits the IP bucket when it has fewer successful requests remaining", async () => {
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
            ? rateLimitResult(true, 5, 4, undefined, 60)
            : rateLimitResult(true, 30, 3, undefined, 45);
        },
      },
      auth: {
        async login() {
          return { token: "token", user: { id: "user-1" } };
        },
      },
    } as never);
    app.decorate("jwt", { sign: vi.fn(() => "token") } as never);
    await app.register(cookie);
    await app.register(authRoutes, { prefix: "/auth" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "alice@example.com", password: "password" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["ratelimit-limit"]).toBe("30");
      expect(response.headers["ratelimit-remaining"]).toBe("3");
      expect(response.headers["ratelimit-reset"]).toBe("45");
    } finally {
      await app.close();
    }
  });

  it("uses absolute remaining when percentage and request count disagree", async () => {
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
            ? rateLimitResult(true, 5, 4, undefined, 60)
            : rateLimitResult(true, 30, 5, undefined, 40);
        },
      },
      auth: {
        async login() {
          return { token: "token", user: { id: "user-1" } };
        },
      },
    } as never);
    app.decorate("jwt", { sign: vi.fn(() => "token") } as never);
    await app.register(cookie);
    await app.register(authRoutes, { prefix: "/auth" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "alice@example.com", password: "password" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["ratelimit-limit"]).toBe("5");
      expect(response.headers["ratelimit-remaining"]).toBe("4");
      expect(response.headers["ratelimit-reset"]).toBe("60");
    } finally {
      await app.close();
    }
  });

  it("uses the earlier reset when successful remaining counts tie", async () => {
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
            ? rateLimitResult(true, 5, 4, undefined, 45)
            : rateLimitResult(true, 30, 4, undefined, 120);
        },
      },
      auth: {
        async login() {
          return { token: "token", user: { id: "user-1" } };
        },
      },
    } as never);
    app.decorate("jwt", { sign: vi.fn(() => "token") } as never);
    await app.register(cookie);
    await app.register(authRoutes, { prefix: "/auth" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "alice@example.com", password: "password" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["ratelimit-limit"]).toBe("5");
      expect(response.headers["ratelimit-remaining"]).toBe("4");
      expect(response.headers["ratelimit-reset"]).toBe("45");
    } finally {
      await app.close();
    }
  });

  it("uses the lower limit when remaining count and reset both tie", async () => {
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
            ? rateLimitResult(true, 5, 4, undefined, 60)
            : rateLimitResult(true, 30, 4, undefined, 60);
        },
      },
      auth: {
        async login() {
          return { token: "token", user: { id: "user-1" } };
        },
      },
    } as never);
    app.decorate("jwt", { sign: vi.fn(() => "token") } as never);
    await app.register(cookie);
    await app.register(authRoutes, { prefix: "/auth" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "alice@example.com", password: "password" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["ratelimit-limit"]).toBe("5");
      expect(response.headers["ratelimit-remaining"]).toBe("4");
      expect(response.headers["ratelimit-reset"]).toBe("60");
    } finally {
      await app.close();
    }
  });
});
