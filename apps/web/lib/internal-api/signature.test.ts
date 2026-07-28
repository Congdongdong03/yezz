import { describe, expect, it } from "vitest";
import {
  assertSameOrigin,
  readTrustedPlatformIp,
  signInternalRequest,
} from "./signature";

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
      "test-secret",
    );

    expect(signed).toMatchObject({
      "x-yezyy-client-ip": "203.0.113.4",
      "x-yezyy-request-id": "00000000-0000-4000-8000-000000000001",
      "x-yezyy-request-timestamp": "1785200000",
      "x-yezyy-body-sha256":
        "b2c9ee672db13673e38e84d0da1a6e765c88b3d0f1dc65244d3f736045aa5c84",
      "x-yezyy-signature":
        "a4e7631b870e48cca985a03e67c24c84c08b020fa98e24af473a305eb4da6273",
    });
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
