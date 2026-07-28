import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const context = (path: string[]) => ({
  params: Promise.resolve({ path }),
});

describe("same-origin backend transport", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    vi.stubEnv("WEB_API_SHARED_SECRET", "test-secret");
  });

  afterEach(() => {
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
});
