import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PUT } from "./route";

const STRONG_SECRET = "0123456789abcdef0123456789abcdef";

const context = (path: string[]) => ({
  params: Promise.resolve({ path }),
});

describe("same-origin backend transport", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    vi.stubEnv("WEB_API_SHARED_SECRET", STRONG_SECRET);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("strips spoofable headers and signs the trusted Vercel client address", async () => {
    const upstream = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json(
          { success: true, data: { id: "booking-1" } },
          { status: 201 },
        );
      },
    );
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request("https://yezyy.com/api/backend/v1/bookings?locale=en", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "00000000-0000-4000-8000-000000000002",
          origin: "https://yezyy.com",
          "x-forwarded-for": "198.51.100.9",
          "x-vercel-forwarded-for": "203.0.113.4",
          "x-yezyy-client-ip": "198.51.100.10",
          "x-yezyy-signature": "fake",
        },
        body: '{"name":"A"}',
      }),
      context(["v1", "bookings"]),
    );

    expect(response.status).toBe(201);
    expect(upstream).toHaveBeenCalledOnce();
    const [target, init] = upstream.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(target).toBe("https://api.example.test/api/v1/bookings?locale=en");
    expect(headers.get("x-yezyy-client-ip")).toBe("203.0.113.4");
    expect(headers.get("idempotency-key")).toBe(
      "00000000-0000-4000-8000-000000000002",
    );
    expect(headers.get("x-yezyy-signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(headers.has("x-forwarded-for")).toBe(false);
    expect(headers.has("x-vercel-forwarded-for")).toBe(false);
    expect(headers.has("host")).toBe(false);
    expect(Buffer.from(init?.body as Uint8Array).toString()).toBe('{"name":"A"}');
  });

  it("rejects cross-origin unsafe requests before contacting the API", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request("https://yezyy.com/api/backend/v1/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
          "x-vercel-forwarded-for": "203.0.113.4",
        },
        body: "{}",
      }),
      context(["v1", "auth", "login"]),
    );

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards the one-use password setup route through the signed same-origin boundary", async () => {
    const upstream = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({ success: true, data: { ok: true } });
      },
    );
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request(
        "https://yezyy.com/api/backend/v1/auth/setup-password",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://yezyy.com",
            "x-vercel-forwarded-for": "203.0.113.4",
          },
          body: JSON.stringify({
            token: "S".repeat(43),
            newPassword: "ClosureOwnerPassword42!",
          }),
        },
      ),
      context(["v1", "auth", "setup-password"]),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/api/v1/auth/setup-password",
    );
  });

  it("forwards password recovery through the signed same-origin boundary", async () => {
    const upstream = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({ success: true, data: { ok: true } });
      },
    );
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request(
        "https://yezyy.com/api/backend/v1/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://yezyy.com",
            "x-vercel-forwarded-for": "203.0.113.4",
          },
          body: JSON.stringify({ email: "owner@example.com" }),
        },
      ),
      context(["v1", "auth", "forgot-password"]),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/api/v1/auth/forgot-password",
    );
  });

  it("accepts the configured loopback origin only in the isolated closure harness", async () => {
    vi.stubEnv("YEZYY_CLOSURE_E2E", "1");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
    const upstream = vi.fn(async () =>
      Response.json(
        { success: true, data: { id: "booking-1" } },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/backend/v1/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://127.0.0.1:3000",
          "x-vercel-forwarded-for": "203.0.113.4",
        },
        body: "{}",
      }),
      context(["v1", "bookings"]),
    );

    expect(response.status).toBe(201);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed in production when the trusted platform address is missing", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request("https://yezyy.com/api/backend/v1/auth/logout", {
        method: "POST",
        headers: { origin: "https://yezyy.com" },
      }),
      context(["v1", "auth", "logout"]),
    );

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not trust a Vercel-named header outside the Vercel platform in production", async () => {
    vi.stubEnv("VERCEL", "");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request("https://yezyy.com/api/backend/v1/auth/logout", {
        method: "POST",
        headers: {
          origin: "https://yezyy.com",
          "x-vercel-forwarded-for": "203.0.113.4",
        },
      }),
      context(["v1", "auth", "logout"]),
    );

    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns a host-only first-party Lax login cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const headers = new Headers({ "content-type": "application/json" });
        headers.append(
          "set-cookie",
          "token=jwt; Domain=api.example.test; Path=/; HttpOnly; Secure; SameSite=None",
        );
        return new Response('{"success":true,"data":{"user":{"id":"1"}}}', {
          status: 200,
          headers,
        });
      }),
    );

    const response = await POST(
      new Request("https://yezyy.com/api/backend/v1/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://yezyy.com",
          "x-vercel-forwarded-for": "203.0.113.4",
        },
        body: '{"email":"admin@example.com","password":"secret"}',
      }),
      context(["v1", "auth", "login"]),
    );

    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("token=jwt");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toMatch(/domain=/i);
  });

  it("forwards exact upload bytes without reconstructing the multipart body", async () => {
    const uploadBytes = Uint8Array.from([
      45, 45, 120, 13, 10, 0, 255, 128, 13, 10, 45, 45, 120, 45, 45,
    ]);
    let forwardedBody: Uint8Array | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_target: string | URL | Request, init?: RequestInit) => {
        forwardedBody = new Uint8Array(init?.body as Uint8Array);
        return Response.json({ success: true, data: { id: "media-1" } });
      }),
    );

    const response = await POST(
      new Request("https://yezyy.com/api/backend/v1/admin/upload", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=x",
          cookie: "token=jwt",
          origin: "https://yezyy.com",
          "x-vercel-forwarded-for": "2001:db8::1",
        },
        body: uploadBytes,
      }),
      context(["v1", "admin", "upload"]),
    );

    expect(response.status).toBe(200);
    expect(forwardedBody).toEqual(uploadBytes);
  });

  it("signs cart-session GET and PUT requests and returns a first-party cookie", async () => {
    const calls: Array<[string | URL | Request, RequestInit | undefined]> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (target: string | URL | Request, init?: RequestInit) => {
        calls.push([target, init]);
        const headers = new Headers({ "content-type": "application/json" });
        headers.append(
          "set-cookie",
          "yezz_cart_session=session-1; Domain=api.example.test; Path=/; HttpOnly; SameSite=Lax",
        );
        return new Response('{"success":true,"data":{"items":[]}}', { headers });
      }),
    );

    const getResponse = await GET(
      new Request("https://yezyy.com/api/backend/v1/cart", {
        headers: {
          cookie: "yezz_cart_session=session-1",
          "x-vercel-forwarded-for": "203.0.113.4",
        },
      }),
      context(["v1", "cart"]),
    );
    const putResponse = await PUT(
      new Request("https://yezyy.com/api/backend/v1/cart", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: "yezz_cart_session=session-1",
          origin: "https://yezyy.com",
          "x-vercel-forwarded-for": "203.0.113.4",
        },
        body: '{"items":[]}',
      }),
      context(["v1", "cart"]),
    );

    expect(getResponse.status).toBe(200);
    expect(putResponse.status).toBe(200);
    expect(calls.map(([target]) => target)).toEqual([
      "https://api.example.test/api/v1/cart",
      "https://api.example.test/api/v1/cart",
    ]);
    for (const [, init] of calls) {
      expect(new Headers(init?.headers).get("x-yezyy-signature")).toMatch(
        /^[a-f0-9]{64}$/,
      );
    }
    expect(getResponse.headers.get("set-cookie")).not.toMatch(/domain=/i);
  });

  it("allows only scoped customer-booking reads and actions through path segments", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-08-12T00:00:00.000Z"));
    const upstream = vi.fn(
      async (target: string | URL | Request, init?: RequestInit) => {
        void target;
        void init;
        return Response.json({ success: true, data: { status: "confirmed" } });
      },
    );
    vi.stubGlobal("fetch", upstream);
    const token = "A".repeat(43);

    const readResponse = await GET(
      new Request(
        `https://yezyy.com/api/backend/v1/customer-bookings/${token}`,
        {
          headers: { "x-vercel-forwarded-for": "203.0.113.4" },
        },
      ),
      context(["v1", "customer-bookings", token]),
    );
    const actionResponse = await POST(
      new Request(
        `https://yezyy.com/api/backend/v1/customer-bookings/${token}/request-reschedule`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://yezyy.com",
            "x-vercel-forwarded-for": "203.0.113.4",
          },
          body: '{"date":"2030-08-14","startTime":"13:30"}',
        },
      ),
      context([
        "v1",
        "customer-bookings",
        token,
        "request-reschedule",
      ]),
    );

    expect(readResponse.status).toBe(200);
    expect(actionResponse.status).toBe(200);
    expect(upstream.mock.calls.map(([target]) => String(target))).toEqual([
      `https://api.example.test/api/v1/customer-bookings/${token}`,
      `https://api.example.test/api/v1/customer-bookings/${token}/request-reschedule`,
    ]);
  });

  it.each([
    ["a past Melbourne date", "2030-08-11", "13:30"],
    ["the eighth Melbourne calendar day", "2030-08-20", "13:30"],
    ["less than two hours lead", "2030-08-12", "11:30"],
  ])(
    "rejects customer reschedules with %s before contacting the API",
    async (_case, date, startTime) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2030-08-12T00:00:00.000Z"));
      const upstream = vi.fn();
      vi.stubGlobal("fetch", upstream);
      const token = "A".repeat(43);

      const response = await POST(
        new Request(
          `https://yezyy.com/api/backend/v1/customer-bookings/${token}/request-reschedule`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://yezyy.com",
              "x-vercel-forwarded-for": "203.0.113.4",
            },
            body: JSON.stringify({ date, startTime }),
          },
        ),
        context([
          "v1",
          "customer-bookings",
          token,
          "request-reschedule",
        ]),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The requested reschedule time is not available",
        },
      });
      expect(upstream).not.toHaveBeenCalled();
    },
  );

  it("rejects an otherwise-valid customer reschedule with an unknown property locally", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-08-12T00:00:00.000Z"));
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const token = "A".repeat(43);

    const response = await POST(
      new Request(
        `https://yezyy.com/api/backend/v1/customer-bookings/${token}/request-reschedule`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://yezyy.com",
            "x-vercel-forwarded-for": "203.0.113.4",
          },
          body: JSON.stringify({
            date: "2030-08-14",
            startTime: "13:30",
            extra: true,
          }),
        },
      ),
      context([
        "v1",
        "customer-bookings",
        token,
        "request-reschedule",
      ]),
    );

    expect(response.status).toBe(400);
    const responseBody = await response.text();
    expect(JSON.parse(responseBody)).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "The requested reschedule time is not available",
      },
    });
    expect(responseBody).not.toContain(token);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin cart-session update", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await PUT(
      new Request("https://yezyy.com/api/backend/v1/cart", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
          "x-vercel-forwarded-for": "203.0.113.4",
        },
        body: '{"items":[]}',
      }),
      context(["v1", "cart"]),
    );

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a weak current signing secret before contacting the API", async () => {
    vi.stubEnv("WEB_API_SHARED_SECRET", "short-secret");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await GET(
      new Request("https://yezyy.com/api/backend/v1/cart", {
        headers: { "x-vercel-forwarded-for": "203.0.113.4" },
      }),
      context(["v1", "cart"]),
    );

    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
});
