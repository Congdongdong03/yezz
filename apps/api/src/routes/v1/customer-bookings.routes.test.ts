import Fastify from "fastify";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import customerBookingsRoutes from "./customer-bookings.routes.js";

const TOKEN = "A".repeat(43);
const VERIFIED_IDENTITY = {
  clientIp: "203.0.113.10",
  requestId: "00000000-0000-4000-8000-000000000001",
  timestamp: 1_785_200_000,
  idempotencyKey: null,
};

function limitResult() {
  return { allowed: true, limit: 12, remaining: 11, resetAfter: 60 };
}

describe("customer booking routes", () => {
  it("uses a dedicated rate-limit scope keyed by verified client identity and token digest prefix", async () => {
    const consume = vi.fn(async () => limitResult());
    const resolve = vi.fn(async () => ({ kind: "experience", status: "confirmed" }));
    const digest = vi.fn(() => "c".repeat(64));
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume },
      customerActions: { resolve, digest },
    } as never);
    await app.register(customerBookingsRoutes, { prefix: "/customer-bookings" });

    try {
      const response = await app.inject({ method: "GET", url: `/customer-bookings/${TOKEN}` });
      expect(response.statusCode).toBe(200);
      expect(resolve).toHaveBeenCalledWith(TOKEN);
      expect(consume).toHaveBeenCalledWith(
        "customer_booking_action",
        `203.0.113.10:${createHash("sha256").update(TOKEN).digest("hex").slice(0, 16)}`,
        12,
        3600,
      );
    } finally {
      await app.close();
    }
  });

  it("returns a generic link error for unknown, revoked, and expired customer links", async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume: vi.fn(async () => limitResult()) },
      customerActions: {
        digest: () => "d".repeat(64),
        resolve: async () => {
          throw new AppError(404, "LINK_INVALID_OR_EXPIRED", "Link invalid");
        },
      },
    } as never);
    await app.register(customerBookingsRoutes, { prefix: "/customer-bookings" });

    try {
      const response = await app.inject({ method: "GET", url: `/customer-bookings/${TOKEN}` });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "LINK_INVALID_OR_EXPIRED" },
      });
    } finally {
      await app.close();
    }
  });

  it("passes only a date and start time to the scoped reschedule action", async () => {
    const requestReschedule = vi.fn(async () => ({ status: "reschedule_requested" }));
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume: vi.fn(async () => limitResult()) },
      customerActions: {
        digest: () => "e".repeat(64),
        requestReschedule,
      },
    } as never);
    await app.register(customerBookingsRoutes, { prefix: "/customer-bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/customer-bookings/${TOKEN}/request-reschedule`,
        payload: { date: "2030-08-14", startTime: "13:30" },
      });
      expect(response.statusCode).toBe(200);
      expect(requestReschedule).toHaveBeenCalledWith(TOKEN, {
        date: "2030-08-14",
        startTime: "13:30",
      });
    } finally {
      await app.close();
    }
  });
});
