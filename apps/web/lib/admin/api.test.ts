import { afterEach, describe, expect, it, vi } from "vitest";
import { getMe, login, updateBookingStatus } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("admin API transport", () => {
  it("sends login and authenticated reads through the same-origin backend", async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({
          success: true,
          data: { id: "user-1", email: "admin@example.com" },
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await login("admin@example.com", "secret");
    await getMe();

    expect(request.mock.calls[0]?.[0]).toBe("/api/backend/v1/auth/login");
    expect(request.mock.calls[1]?.[0]).toBe("/api/backend/v1/admin/me");
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      method: "POST",
    });
  });

  it("sends compare-and-set booking status data to the dedicated endpoint", async () => {
    const request = vi.fn(async () =>
      Response.json({
        success: true,
        data: { id: "booking-1", status: "confirmed", replayed: false },
      }),
    );
    vi.stubGlobal("fetch", request);
    const operationId = "00000000-0000-4000-8000-000000000001";

    await updateBookingStatus("booking-1", {
      status: "confirmed",
      expectedStatus: "contacted",
      operationId,
      note: "已电话确认",
    });

    expect(request).toHaveBeenCalledWith(
      "/api/backend/v1/admin/bookings/booking-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "confirmed",
          expectedStatus: "contacted",
          operationId,
          note: "已电话确认",
        }),
      }),
    );
  });
});
