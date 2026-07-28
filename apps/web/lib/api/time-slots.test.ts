import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDaySlots, fetchMonthAvailability } from "./time-slots";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("party time-slot queries", () => {
  it("requests the global-only scope for party day and month calendars", async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({
          success: true,
          data: { dates: [], slots: [] },
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await fetchMonthAvailability(2030, 8, null as never);
    await fetchDaySlots("2030-08-12", null as never);

    expect(request.mock.calls.map(([url]) => String(url))).toEqual([
      "http://localhost:4000/api/v1/time-slots?year=2030&month=8&scope=global",
      "http://localhost:4000/api/v1/time-slots?date=2030-08-12&scope=global",
    ]);
  });
});
