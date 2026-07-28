import { describe, expect, it, vi } from "vitest";
import type { RateLimitsService } from "../services/rate-limits.service.js";
import {
  enforceRequestLimit,
  resolvePublicRateLimitSubject,
} from "./public-request-limit.js";

const VERIFIED_IDENTITY = {
  clientIp: "203.0.113.10",
  requestId: "00000000-0000-4000-8000-000000000001",
  timestamp: 1_785_200_000,
  idempotencyKey: null,
};

function requestIdentity(
  verifiedClientIdentity: typeof VERIFIED_IDENTITY | null,
  ip = "127.0.0.1",
) {
  return { verifiedClientIdentity, ip };
}

describe("public request limit identity", () => {
  it("uses only the verified signed client IP in production", () => {
    expect(
      resolvePublicRateLimitSubject(
        requestIdentity(VERIFIED_IDENTITY, "198.51.100.200"),
        {
          nodeEnv: "production",
          internalRequestEnforcement: "require",
          allowLocalFallback: false,
        },
      ),
    ).toBe("203.0.113.10");
  });

  it("canonicalizes equivalent verified IPv6 subjects into one identity", () => {
    expect(
      resolvePublicRateLimitSubject(
        requestIdentity({
          ...VERIFIED_IDENTITY,
          clientIp: "2001:0db8:0:0:0:0:0:1",
        }),
        {
          nodeEnv: "production",
          internalRequestEnforcement: "require",
          allowLocalFallback: false,
        },
      ),
    ).toBe("2001:db8::1");
  });

  it("fails closed when production has no verified signed client IP", () => {
    expect(() =>
      resolvePublicRateLimitSubject(requestIdentity(null), {
        nodeEnv: "production",
        internalRequestEnforcement: "log",
        allowLocalFallback: true,
      }),
    ).toThrowError(
      expect.objectContaining({
        statusCode: 503,
        code: "RATE_LIMIT_UNAVAILABLE",
      }),
    );
  });

  it("allows only an explicitly enabled loopback fallback in local log mode", () => {
    expect(
      resolvePublicRateLimitSubject(requestIdentity(null), {
        nodeEnv: "development",
        internalRequestEnforcement: "log",
        allowLocalFallback: true,
      }),
    ).toBe("127.0.0.1");

    for (const unsafeOptions of [
      {
        nodeEnv: "development",
        internalRequestEnforcement: "log",
        allowLocalFallback: false,
      },
      {
        nodeEnv: "development",
        internalRequestEnforcement: "require",
        allowLocalFallback: true,
      },
    ]) {
      expect(() =>
        resolvePublicRateLimitSubject(requestIdentity(null), unsafeOptions),
      ).toThrowError(
        expect.objectContaining({ code: "RATE_LIMIT_UNAVAILABLE" }),
      );
    }
    expect(() =>
      resolvePublicRateLimitSubject(requestIdentity(null, "192.168.1.20"), {
        nodeEnv: "development",
        internalRequestEnforcement: "log",
        allowLocalFallback: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "RATE_LIMIT_UNAVAILABLE" }));
  });
});

describe("enforceRequestLimit", () => {
  it("sets exact limit metadata and Retry-After on a rejected request", async () => {
    const service: RateLimitsService = {
      consume: vi.fn(async () => ({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: new Date("2026-07-28T10:00:00.000Z"),
        resetAfter: 60,
        retryAfter: 60,
      })),
      async purgeExpired() {},
    };
    const headers: Record<string, string> = {};
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
        return this;
      },
    } as never;

    await expect(
      enforceRequestLimit(service, "booking", "203.0.113.10", 5, 3600, reply),
    ).rejects.toMatchObject({ statusCode: 429, code: "RATE_LIMITED" });
    expect(headers).toEqual({
      "RateLimit-Limit": "5",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": "60",
      "Retry-After": "60",
    });
  });

  it("sets remaining and reset metadata on an allowed request", async () => {
    const service: RateLimitsService = {
      async consume() {
        return {
          allowed: true,
          limit: 5,
          remaining: 4,
          resetAt: new Date("2026-07-28T10:00:00.000Z"),
          resetAfter: 60,
        };
      },
      async purgeExpired() {},
    };
    const headers: Record<string, string> = {};
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
        return this;
      },
    } as never;

    await enforceRequestLimit(
      service,
      "booking",
      "203.0.113.10",
      5,
      3600,
      reply,
    );

    expect(headers).toEqual({
      "RateLimit-Limit": "5",
      "RateLimit-Remaining": "4",
      "RateLimit-Reset": "60",
    });
  });
});
