import { describe, expect, it } from "vitest";
import {
  assertSameOrigin,
  readTrustedPlatformIp,
  signInternalRequest,
} from "./signature";

const STRONG_SECRET = "0123456789abcdef0123456789abcdef";

describe("internal request signing", () => {
  it("signs the canonical method, target, identity, idempotency key, and body bytes", () => {
    const signed = signInternalRequest(
      {
        method: "POST",
        pathAndQuery: "/api/v1/bookings",
        requestId: "00000000-0000-4000-8000-000000000001",
        timestamp: 1_785_200_000,
        clientIp: "203.0.113.4",
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
        body: new TextEncoder().encode('{"name":"A"}'),
      },
      STRONG_SECRET,
    );

    expect(signed).toMatchObject({
      "x-yezyy-client-ip": "203.0.113.4",
      "x-yezyy-request-id": "00000000-0000-4000-8000-000000000001",
      "x-yezyy-request-timestamp": "1785200000",
      "x-yezyy-body-sha256":
        "b2c9ee672db13673e38e84d0da1a6e765c88b3d0f1dc65244d3f736045aa5c84",
      "x-yezyy-signature":
        "2862b9cc148d2914978b8a8eeb47fe68ab35fab0762dd403a38f5019d3c3f3fb",
    });
  });

  it("rejects a weak signing secret without exposing it", () => {
    expect(() =>
      signInternalRequest(
        {
          method: "GET",
          pathAndQuery: "/api/v1/cart",
          requestId: "00000000-0000-4000-8000-000000000001",
          timestamp: 1_785_200_000,
          clientIp: "203.0.113.4",
          body: new Uint8Array(),
        },
        "short-secret",
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "WEAK_INTERNAL_SHARED_SECRET",
        message: expect.not.stringContaining("short-secret"),
      }),
    );
  });

  it("fails closed when Vercel does not provide one valid client address", () => {
    expect(() => readTrustedPlatformIp(new Headers(), true)).toThrowError(
      expect.objectContaining({ code: "TRUSTED_CLIENT_IP_REQUIRED" }),
    );

    expect(() =>
      readTrustedPlatformIp(
        new Headers({ "x-vercel-forwarded-for": "203.0.113.4, 198.51.100.2" }),
        true,
      ),
    ).toThrowError(expect.objectContaining({ code: "TRUSTED_CLIENT_IP_REQUIRED" }));
  });

  it("normalizes trusted addresses and uses loopback only outside Vercel", () => {
    expect(
      readTrustedPlatformIp(
        new Headers({ "x-vercel-forwarded-for": " 2001:DB8::1 " }),
        true,
      ),
    ).toBe("2001:db8::1");
    expect(readTrustedPlatformIp(new Headers(), false)).toBe("127.0.0.1");
  });

  it("rejects missing and cross-origin unsafe requests", () => {
    expect(() => assertSameOrigin(null, "https://yezyy.com")).toThrowError(
      expect.objectContaining({ code: "INVALID_ORIGIN" }),
    );
    expect(() =>
      assertSameOrigin("https://attacker.example", "https://yezyy.com"),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ORIGIN" }));
    expect(() =>
      assertSameOrigin("https://yezyy.com/path", "https://yezyy.com"),
    ).not.toThrow();
  });
});
