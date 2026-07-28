import { createHash, createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  registerInternalRequestProtection,
  verifyInternalRequest,
} from "./internal-request.js";

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-000000000002";
const TIMESTAMP = 1_785_200_000;
const SECRET = "test-secret";

function signedFixture({
  body,
  method = "POST",
  pathAndQuery = "/api/v1/bookings",
  timestamp = TIMESTAMP,
  idempotencyKey = IDEMPOTENCY_KEY,
}: {
  body: Uint8Array;
  method?: string;
  pathAndQuery?: string;
  timestamp?: number;
  idempotencyKey?: string;
}) {
  const bodyDigest = createHash("sha256").update(body).digest("hex");
  const canonical = [
    method,
    pathAndQuery,
    REQUEST_ID,
    String(timestamp),
    "203.0.113.4",
    idempotencyKey,
    bodyDigest,
  ].join("\n");
  const signature = createHmac("sha256", SECRET).update(canonical).digest("hex");
  const headers = new Headers({
    "x-yezyy-body-sha256": bodyDigest,
    "x-yezyy-client-ip": "203.0.113.4",
    "x-yezyy-request-id": REQUEST_ID,
    "x-yezyy-request-timestamp": String(timestamp),
    "x-yezyy-signature": signature,
  });
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

  return {
    request: { method, url: pathAndQuery, headers },
    body,
  };
}

describe("internal request verification", () => {
  it("returns the verified client identity for exact JSON bytes", () => {
    const fixture = signedFixture({
      body: new TextEncoder().encode('{"name":"A"}'),
    });

    expect(
      verifyInternalRequest(fixture.request, fixture.body, {
        secrets: [SECRET],
        now: TIMESTAMP,
      }),
    ).toEqual({
      clientIp: "203.0.113.4",
      idempotencyKey: IDEMPOTENCY_KEY,
      requestId: REQUEST_ID,
      timestamp: TIMESTAMP,
    });
  });

  it("verifies exact multipart bytes without decoding or re-encoding them", () => {
    const binaryBody = Uint8Array.from([
      45, 45, 120, 13, 10, 0, 255, 128, 13, 10, 45, 45, 120, 45, 45,
    ]);
    const fixture = signedFixture({
      body: binaryBody,
      pathAndQuery: "/api/v1/admin/upload?folder=gallery",
    });

    expect(
      verifyInternalRequest(fixture.request, fixture.body, {
        secrets: SECRET,
        now: TIMESTAMP,
      }),
    ).toMatchObject({ clientIp: "203.0.113.4", requestId: REQUEST_ID });
  });

  it("rejects a changed body and an expired timestamp", () => {
    const fixture = signedFixture({
      body: new TextEncoder().encode('{"name":"A"}'),
    });

    expect(() =>
      verifyInternalRequest(
        fixture.request,
        new TextEncoder().encode('{"name":"B"}'),
        { secrets: SECRET, now: TIMESTAMP },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INTERNAL_SIGNATURE" }));

    expect(() =>
      verifyInternalRequest(fixture.request, fixture.body, {
        secrets: SECRET,
        now: TIMESTAMP + 301,
      }),
    ).toThrowError(expect.objectContaining({ code: "EXPIRED_INTERNAL_SIGNATURE" }));
  });

  it("rejects target and idempotency-key replay changes", () => {
    const fixture = signedFixture({
      body: new TextEncoder().encode("{}"),
      pathAndQuery: "/api/v1/bookings?locale=en",
    });

    expect(() =>
      verifyInternalRequest(
        { ...fixture.request, url: "/api/v1/bookings?locale=zh" },
        fixture.body,
        { secrets: SECRET, now: TIMESTAMP },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INTERNAL_SIGNATURE" }));

    const changedHeaders = new Headers(fixture.request.headers);
    changedHeaders.set(
      "idempotency-key",
      "00000000-0000-4000-8000-000000000003",
    );
    expect(() =>
      verifyInternalRequest(
        { ...fixture.request, headers: changedHeaders },
        fixture.body,
        { secrets: SECRET, now: TIMESTAMP },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INTERNAL_SIGNATURE" }));
  });
});

describe("internal request enforcement", () => {
  it("requires signed transport on auth, admin, and public create routes only", async () => {
    const app = Fastify({ logger: false });
    registerInternalRequestProtection(app, {
      enforcement: "require",
      secrets: SECRET,
      now: () => TIMESTAMP,
    });
    app.post("/api/v1/auth/login", async () => ({ ok: true }));
    app.get("/api/v1/projects", async () => ({ ok: true }));

    expect(
      (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: {} }))
        .statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/api/v1/projects" })).statusCode,
    ).toBe(200);

    await app.close();
  });

  it("preserves exact JSON bytes for parsing after signature verification", async () => {
    const app = Fastify({ logger: false });
    registerInternalRequestProtection(app, {
      enforcement: "require",
      secrets: SECRET,
      now: () => TIMESTAMP,
    });
    app.post("/api/v1/bookings", async (request) => ({
      body: request.body,
      identity: request.verifiedClientIdentity,
    }));
    const rawBody = new TextEncoder().encode('{"name":"A", "people":2}');
    const fixture = signedFixture({ body: rawBody });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: {
        "content-type": "application/json",
        ...Object.fromEntries(fixture.request.headers),
      },
      payload: Buffer.from(rawBody),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      body: { name: "A", people: 2 },
      identity: {
        clientIp: "203.0.113.4",
        idempotencyKey: IDEMPOTENCY_KEY,
        requestId: REQUEST_ID,
        timestamp: TIMESTAMP,
      },
    });

    await app.close();
  });

  it("preserves exact multipart bytes for the upload parser", async () => {
    const app = Fastify({ logger: false });
    registerInternalRequestProtection(app, {
      enforcement: "require",
      secrets: SECRET,
      now: () => TIMESTAMP,
    });
    app.addContentTypeParser(
      /^multipart\/form-data/,
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );
    app.post("/api/v1/admin/upload", async (request) => ({
      hex: Buffer.from(request.body as Buffer).toString("hex"),
    }));
    const rawBody = Uint8Array.from([
      45, 45, 120, 13, 10, 0, 255, 128, 13, 10, 45, 45, 120, 45, 45,
    ]);
    const fixture = signedFixture({
      body: rawBody,
      pathAndQuery: "/api/v1/admin/upload",
      idempotencyKey: "",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/upload",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
        ...Object.fromEntries(fixture.request.headers),
      },
      payload: Buffer.from(rawBody),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ hex: Buffer.from(rawBody).toString("hex") });

    await app.close();
  });
});
