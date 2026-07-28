import { afterEach, describe, expect, it, vi } from "vitest";
import { submitBooking } from "./booking";
import { submitCart } from "./cart";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public request action transport", () => {
  it("submits bookings through the canonical same-origin backend with idempotency", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://yezyy.com");
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({ success: true, data: { id: "booking-1" } });
      },
    );
    vi.stubGlobal("fetch", request);
    const form = new FormData();
    form.set("name", "A");
    form.set("phone", "0430000000");
    form.set("email", "a@example.com");
    form.set("numberOfPeople", "1");
    form.set("projectId", "00000000-0000-4000-8000-000000000001");
    form.set("timeSlotId", "00000000-0000-4000-8000-000000000002");

    await submitBooking(form);

    const [target, init] = request.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(target).toBe("/api/backend/v1/bookings");
    expect(headers.get("idempotency-key")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("submits cart requests through the canonical same-origin backend with idempotency", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://yezyy.com");
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({ success: true, data: { id: "order-1" } });
      },
    );
    vi.stubGlobal("fetch", request);
    const form = new FormData();
    form.set("name", "A");
    form.set("phone", "0430000000");
    form.set("items", "[]");

    await submitCart(form);

    const [target, init] = request.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(target).toBe("/api/backend/v1/cart-orders");
    expect(headers.get("idempotency-key")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
