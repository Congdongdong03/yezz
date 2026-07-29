import { createHash, createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerInternalRequestProtection } from "./internal-request.js";
import {
  isCustomerBookingRequestPath,
  safeRequestUrl,
  serializeRequestForLog,
} from "./request-log-redaction.js";
import customerBookingsRoutes from "../routes/v1/customer-bookings.routes.js";

const token = `-${"A".repeat(42)}`;
const encodedToken = `%2D${"A".repeat(42)}`;
const doubleEncodedToken = `%252D${"A".repeat(42)}`;
const malformedToken = `${encodedToken}%ZZ`;
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

async function buildCustomerLogApp() {
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
    partyCustomerActions: {
      acceptPartyTimeByToken: async () => ({ ok: true }),
    },
  } as never);
  await app.register(customerBookingsRoutes, {
    prefix: "/api/v1/customer-bookings",
  });
  return { app, entries };
}

function requestLogs(entries: string[], start: number) {
  return entries.slice(start).map(
    (entry) =>
      JSON.parse(entry) as {
        msg?: string;
        path?: string;
        req?: { url?: string };
      },
  );
}

function expectNoBearerMaterial(serializedLogs: string) {
  expect(serializedLogs).not.toContain(token);
  expect(serializedLogs).not.toContain(encodedToken);
  expect(serializedLogs).not.toContain(doubleEncodedToken);
  expect(serializedLogs).not.toContain(malformedToken);
}

describe("customer booking request log redaction", () => {
  it.each([
    {
      name: "a literal bearer embedded in a non-sensitive key",
      query: `prefix${token}suffix=x`,
    },
    {
      name: "a percent-encoded bearer embedded in a non-sensitive key",
      query: `prefix${encodedToken}suffix=x`,
    },
    {
      name: "a double-encoded bearer embedded in a non-sensitive key",
      query: `prefix${doubleEncodedToken}suffix=x`,
    },
    {
      name: "a literal bearer embedded in a non-sensitive value",
      query: `source=prefix${token}suffix`,
    },
    {
      name: "a percent-encoded bearer embedded in a non-sensitive value",
      query: `source=prefix${encodedToken}suffix`,
    },
    {
      name: "a double-encoded bearer embedded in a non-sensitive value",
      query: `source=prefix${doubleEncodedToken}suffix`,
    },
    {
      name: "a sensitive key bearing a literal token",
      query: `signature-prefix${token}suffix=x`,
    },
  ])("redacts $name", ({ query }) => {
    const serialized = safeRequestUrl(
      `/api/v1/customer-bookings/${encodedToken}?${query}`,
    );

    expect(serialized).toBe("/api/v1/customer-bookings/:token?[REDACTED]");
    expectNoBearerMaterial(serialized);
  });

  it("redacts prefixed and suffixed bearer forms from both signed Fastify log paths", async () => {
    const { app, entries } = await buildCustomerLogApp();
    const queryFragments = [token, encodedToken, doubleEncodedToken];
    const queries = queryFragments.flatMap((fragment) => [
      `prefix${fragment}suffix=x`,
      `source=prefix${fragment}suffix`,
      `signature-prefix${fragment}suffix=x`,
    ]);

    try {
      for (const query of queries) {
        const start = entries.length;
        const url = `/api/v1/customer-bookings/${encodedToken}?${query}`;
        const response = await app.inject({
          method: "GET",
          url,
          headers: signedHeaders({ method: "GET", url }),
        });

        expect(response.statusCode).toBe(200);
        const logs = requestLogs(entries, start);
        const expectedPath = "/api/v1/customer-bookings/:token?[REDACTED]";
        expect(
          logs.find((entry) => entry.msg === "incoming request")?.req?.url,
        ).toBe(expectedPath);
        expect(
          logs.find((entry) => entry.msg === "Internal request verification")
            ?.path,
        ).toBe(expectedPath);
        expectNoBearerMaterial(JSON.stringify(logs));
      }
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      name: "a malformed customer path segment",
      url: `/api/v1/customer-bookings/${malformedToken}/request-cancellation`,
      expected: "/api/v1/customer-bookings/:token/[REDACTED]",
    },
    {
      name: "a malformed query key containing an encoded bearer",
      url: `/api/v1/customer-bookings/${encodedToken}?${malformedToken}=x`,
      expected: "/api/v1/customer-bookings/:token?[REDACTED]",
    },
    {
      name: "a malformed query value containing an encoded bearer",
      url: `/api/v1/customer-bookings/${encodedToken}?source=${malformedToken}`,
      expected: "/api/v1/customer-bookings/:token?[REDACTED]",
    },
    {
      name: "a literal bearer query key",
      url: `/api/v1/customer-bookings/${encodedToken}?${token}=x`,
      expected: "/api/v1/customer-bookings/:token?[REDACTED]",
    },
    {
      name: "an encoded bearer query value",
      url: `/api/v1/customer-bookings/${encodedToken}?source=${encodedToken}`,
      expected: "/api/v1/customer-bookings/:token?[REDACTED]",
    },
  ])("fails closed for $name", ({ url, expected }) => {
    const serialized = safeRequestUrl(url);

    expect(serialized).toBe(expected);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(encodedToken);
    expect(serialized).not.toContain(malformedToken);
  });

  it("recognizes only a strict decoded customer action path for verification", () => {
    expect(
      isCustomerBookingRequestPath(
        `/api/v1/customer-bookings/${encodedToken}/request-cancellation`,
      ),
    ).toBe(true);
    expect(
      isCustomerBookingRequestPath(
        `/api/v1/customer-bookings/${malformedToken}/request-cancellation`,
      ),
    ).toBe(false);
  });

  it("redacts a malformed customer path component in the real Fastify request serializer", async () => {
    const entries: string[] = [];
    const app = Fastify({
      logger: {
        level: "info",
        serializers: { req: serializeRequestForLog },
        stream: { write: (chunk: string) => entries.push(chunk) },
      },
    });
    app.get("/probe", async (request) => {
      request.log.info(
        {
          req: {
            id: request.id,
            method: request.method,
            url: `/api/v1/customer-bookings/${malformedToken}`,
          },
        },
        "malformed customer path",
      );
      return { ok: true };
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/probe",
      });

      expect(response.statusCode).toBe(200);
      const serializedLogs = entries.join("");
      expect(serializedLogs).toContain(
        "/api/v1/customer-bookings/:token/[REDACTED]",
      );
      expectNoBearerMaterial(serializedLogs);
    } finally {
      await app.close();
    }
  });

  it("keeps literal and encoded signed and unsigned action logs safe in both Fastify paths", async () => {
    const { app, entries } = await buildCustomerLogApp();
    const actions: Array<{
      method: "GET" | "POST";
      path: string;
      query: string;
      body?: Uint8Array;
    }> = [
      { method: "GET", path: "", query: "?source=mail" },
      {
        method: "POST",
        path: "/request-cancellation",
        query: "?campaign=win",
      },
      { method: "POST", path: "/accept-time", query: "?source=sms" },
      {
        method: "POST",
        path: "/request-reschedule",
        query: "?ref=reminder",
        body: new TextEncoder().encode(
          '{"date":"2030-08-14","startTime":"13:30"}',
        ),
      },
    ];

    try {
      for (const pathToken of [token, encodedToken]) {
        for (const signed of [true, false]) {
          for (const action of actions) {
            const start = entries.length;
            const url = `/api/v1/customer-bookings/${pathToken}${action.path}${action.query}`;
            const body = action.body ?? new Uint8Array();
            const response = await app.inject({
              method: action.method,
              url,
              headers: {
                ...(signed
                  ? signedHeaders({ method: action.method, url, body })
                  : {}),
                ...(action.body ? { "content-type": "application/json" } : {}),
              },
              ...(action.body ? { payload: Buffer.from(action.body) } : {}),
            });

            expect(response.statusCode).toBe(signed ? 200 : 401);
            const logs = requestLogs(entries, start);
            const expectedPath = `/api/v1/customer-bookings/:token${action.path}${action.query}`;
            expect(
              logs.find((entry) => entry.msg === "incoming request")?.req?.url,
            ).toBe(expectedPath);
            expect(
              logs.find(
                (entry) => entry.msg === "Internal request verification",
              )?.path,
            ).toBe(expectedPath);
            expectNoBearerMaterial(JSON.stringify(logs));
          }
        }
      }
    } finally {
      await app.close();
    }
  });

  it("uses a constant fail-closed query representation in both Fastify log paths", async () => {
    const { app, entries } = await buildCustomerLogApp();
    const malformedQueries = [
      `?${malformedToken}=x`,
      `?source=${malformedToken}`,
      `?${token}=x`,
      `?source=${encodedToken}`,
    ];

    try {
      for (const query of malformedQueries) {
        const start = entries.length;
        const url = `/api/v1/customer-bookings/${encodedToken}${query}`;
        const response = await app.inject({
          method: "GET",
          url,
          headers: signedHeaders({ method: "GET", url }),
        });

        expect(response.statusCode).toBe(200);
        const logs = requestLogs(entries, start);
        const expectedPath = "/api/v1/customer-bookings/:token?[REDACTED]";
        expect(
          logs.find((entry) => entry.msg === "incoming request")?.req?.url,
        ).toBe(expectedPath);
        expect(
          logs.find((entry) => entry.msg === "Internal request verification")
            ?.path,
        ).toBe(expectedPath);
        expectNoBearerMaterial(JSON.stringify(logs));
      }
    } finally {
      await app.close();
    }
  });

  it("does not let malformed query-key encoding crash Fastify request logging", async () => {
    const entries: string[] = [];
    const app = Fastify({
      logger: {
        level: "info",
        serializers: { req: serializeRequestForLog },
        stream: { write: (chunk: string) => entries.push(chunk) },
      },
    });
    app.get("/probe", async () => ({ ok: true }));

    try {
      const response = await app.inject({
        method: "GET",
        url: "/probe?%ZZ=x",
      });

      expect(response.statusCode).toBe(200);
      expect(entries.join("")).toContain("/probe?[REDACTED]");
    } finally {
      await app.close();
    }
  });

  it.each([
    `/api/v1/customer-bookings/${token}`,
    `/api/v1/customer-bookings/${token}/request-cancellation`,
  ])("does not emit a bearer token for %s", (url) => {
    const logged = serializeRequestForLog({
      id: "request-1",
      method: "POST",
      url,
    });

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
      url: `/api/v1/customer-bookings/${encodedToken}`,
    });
    await app.close();

    const logs = entries.join("");
    expect(logs).not.toContain(token);
    expect(logs).not.toContain(encodedToken);
    expect(logs).toContain("/api/v1/customer-bookings/:token");
  });

  it("redacts an encoded token in each Fastify and internal-verification log while retaining safe query evidence", async () => {
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
      partyCustomerActions: {
        acceptPartyTimeByToken: async () => ({ ok: true }),
      },
    } as never);
    await app.register(customerBookingsRoutes, {
      prefix: "/api/v1/customer-bookings",
    });

    const requests: Array<{
      method: "GET" | "POST";
      suffix: string;
      expectedPath: string;
      body?: Uint8Array;
    }> = [
      {
        method: "GET",
        suffix: "?source=mail&signature=raw-signature",
        expectedPath:
          "/api/v1/customer-bookings/:token?source=mail&signature=[REDACTED]",
      },
      {
        method: "POST",
        suffix: "/request-cancellation?campaign=win&token=query-token",
        expectedPath:
          "/api/v1/customer-bookings/:token/request-cancellation?campaign=win&token=[REDACTED]",
      },
      {
        method: "POST",
        suffix: "/accept-time?source=sms",
        expectedPath: "/api/v1/customer-bookings/:token/accept-time?source=sms",
      },
      {
        method: "POST",
        suffix: "/request-reschedule?ref=reminder&secret=query-secret",
        expectedPath:
          "/api/v1/customer-bookings/:token/request-reschedule?ref=reminder&secret=[REDACTED]",
        body: new TextEncoder().encode(
          '{"date":"2030-08-14","startTime":"13:30"}',
        ),
      },
    ];

    for (const request of requests) {
      const logStart = entries.length;
      const url = `/api/v1/customer-bookings/${encodedToken}${request.suffix}`;
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

      const requestLogs = entries.slice(logStart).map(
        (entry) =>
          JSON.parse(entry) as {
            msg?: string;
            path?: string;
            req?: { url?: string };
          },
      );
      const incoming = requestLogs.find(
        (entry) => entry.msg === "incoming request",
      );
      const verification = requestLogs.find(
        (entry) => entry.msg === "Internal request verification",
      );
      expect(incoming?.req?.url).toBe(request.expectedPath);
      expect(verification?.path).toBe(request.expectedPath);

      const serializedLogs = JSON.stringify(requestLogs);
      expect(serializedLogs).not.toContain(token);
      expect(serializedLogs).not.toContain(encodedToken);
      expect(serializedLogs).not.toContain("raw-signature");
      expect(serializedLogs).not.toContain("query-token");
      expect(serializedLogs).not.toContain("query-secret");
    }
    await app.close();

    const logs = entries.join("");
    expect(logs).not.toContain(token);
    expect(logs).not.toContain(encodedToken);
    expect(logs).not.toContain("raw-signature");
    expect(logs).not.toContain("query-token");
    expect(logs).not.toContain("query-secret");
    expect(logs).toContain(
      "/api/v1/customer-bookings/:token?source=mail&signature=[REDACTED]",
    );
    expect(logs).toContain("campaign=win&token=[REDACTED]");
    expect(logs).toContain("ref=reminder&secret=[REDACTED]");
  });
});
