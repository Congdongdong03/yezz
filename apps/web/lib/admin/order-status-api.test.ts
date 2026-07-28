import { afterEach, describe, expect, it, vi } from "vitest";
import { updateOrderStatus } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("updateOrderStatus", () => {
  it("sends the compare-and-set body to the cart status endpoint", async () => {
    const request = vi.fn<
      (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>
    >(async () =>
      Response.json({
        success: true,
        data: {
          id: "00000000-0000-4000-8000-000000000001",
          status: "confirmed",
        },
      }),
    );
    vi.stubGlobal("fetch", request);
    const input = {
      status: "confirmed" as const,
      expectedStatus: "contacted" as const,
      operationId: "00000000-0000-4000-8000-000000000002",
      note: "Confirmed by phone",
    };

    await updateOrderStatus(
      "00000000-0000-4000-8000-000000000001",
      input,
    );

    expect(request).toHaveBeenCalledOnce();
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe(
      "/api/backend/v1/admin/orders/00000000-0000-4000-8000-000000000001/status",
    );
    expect(init).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });
});
