import { createHash, createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerInternalRequestProtection } from "./internal-request.js";
import { serializeRequestForLog } from "./request-log-redaction.js";
import customerBookingsRoutes from "../routes/v1/customer-bookings.routes.js";

const token = "A".repeat(43);
const SECRET = "0123456789abcdef0123456789abcdef";
const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const TIMESTAMP = 1_785_200_000;

function signedHeaders(input: {
  method: string;
  url: string;
  body?: Uint8Array;
}): Record<string, string> {
  const body = input.body ?? new Uint8Array();
  const digest = createHash("sha256").update(body).digest("hex");
  const canonical = [
    input.method,
    input.url,
    REQUEST_ID,
    String(TIMESTAMP),
    "203.0.113.4",
    "",
    digest,
  ].join("\n");
  return {
    "x-yezyy-body-sha256": digest,
    "x-yezyy-client-ip": "203.0.113.4",
    "x-yezyy-request-id": REQUEST_ID,
    "x-yezyy-request-timestamp": String(TIMESTAMP),
    "x-yezyy-signature": createHmac("sha256", SECRET)
      .update(canonical)
      .digest("hex"),
  };
}

describe("customer booking request log redaction", () => {
  it.each([
    `/api/v1/customer-bookings/${token}`,
    `/api/v1/customer-bookings/${token}/request-cancellation`,
  ])("does not emit a bearer token for %s", (url) => {
    const logged = serializeRequestForLog({ id: "request-1", method: "POST", url });

    expect(JSON.stringify(logged)).not.toContain(token);
    expect(logged).toEqual({
      requestId: "request-1",
      method: "POST",
      url: url.replace(token, ":token"),
    });
  });

  it("redacts a customer token in the real Fastify request logger", async () => {
    const entries: string[] = [];
    const app = Fastify({
      logger: {
        level: "info",
        serializers: { req: serializeRequestForLog },
        stream: {
          write(chunk: string) {
            entries.push(chunk);
          },
        },
      },
    });
    app.get("/api/v1/customer-bookings/:token", async (request) => {
      request.log.info({ req: request }, "customer booking loaded");
      return { ok: true };
    });

    await app.inject({
      method: "GET",
      url: `/api/v1/customer-bookings/${token}`,
    });
    await app.close();

    const logs = entries.join("");
    expect(logs).not.toContain(token);
    expect(logs).toContain("/api/v1/customer-bookings/:token");
  });

  it("redacts tokens from the complete Fastify and internal-verification log stream while retaining safe query evidence", async () => {
    const entries: string[] = [];
    const app = Fastify({
      logger: {
        level: "info",
        serializers: { req: serializeRequestForLog },
        stream: { write: (chunk: string) => entries.push(chunk) },
      },
    });
    registerInternalRequestProtection(app, {
      enforcement: "require",
      secrets: SECRET,
      now: () => TIMESTAMP,
    });
    app.decorate("services", {
      rateLimits: {
        consume: async () => ({
          allowed: true,
          limit: 12,
          remaining: 11,
          resetAt: new Date("2026-07-28T10:00:00.000Z"),
          resetAfter: 60,
        }),
      },
      customerActions: {
        resolve: async () => ({ ok: true }),
        requestCancellation: async () => ({ ok: true }),
        requestReschedule: async () => ({ ok: true }),
      },
      partyCustomerActions: { acceptPartyTimeByToken: async () => ({ ok: true }) },
    } as never);
    await app.register(customerBookingsRoutes, {
      prefix: "/api/v1/customer-bookings",
    });

    const requests: Array<{
      method: "GET" | "POST";
      suffix: string;
      body?: Uint8Array;
    }> = [
      { method: "GET", suffix: "?source=mail&signature=raw-signature" },
      { method: "POST", suffix: "/request-cancellation?campaign=win&token=query-token" },
      { method: "POST", suffix: "/accept-time?source=sms" },
      {
        method: "POST",
        suffix: "/request-reschedule?ref=reminder&secret=query-secret",
        body: new TextEncoder().encode('{"date":"2030-08-14","startTime":"13:30"}'),
      },
    ];

    for (const request of requests) {
      const url = `/api/v1/customer-bookings/${token}${request.suffix}`;
      const body = request.body ?? new Uint8Array();
      const response = await app.inject({
        method: request.method,
        url,
        headers: {
          ...signedHeaders({ method: request.method, url, body }),
          ...(request.body ? { "content-type": "application/json" } : {}),
        },
        ...(request.body ? { payload: Buffer.from(request.body) } : {}),
      });
      expect(response.statusCode).toBe(200);
    }
    await app.close();

    const logs = entries.join("");
    expect(logs).not.toContain(token);
    expect(logs).not.toContain("raw-signature");
    expect(logs).not.toContain("query-token");
    expect(logs).not.toContain("query-secret");
    expect(logs).toContain("/api/v1/customer-bookings/:token?source=mail&signature=[REDACTED]");
    expect(logs).toContain("campaign=win&token=[REDACTED]");
    expect(logs).toContain("ref=reminder&secret=[REDACTED]");
  });
});
