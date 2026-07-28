import { afterEach, describe, expect, it, vi } from "vitest";
import { getMe, login } from "./api";

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
});
