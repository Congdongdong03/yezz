import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOrdinaryAvailability,
  getPartyAvailability,
} from "./availability";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getOrdinaryAvailability", () => {
  it("requests the selected date, longest duration, and total physical attendance", async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json({
          success: true,
          data: [
            {
              date: "2030-08-12",
              startTime: "10:30",
              endTime: "11:30",
              status: "available",
              remaining: 5,
            },
          ],
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(
      getOrdinaryAvailability({
        date: "2030-08-12",
        durationMinutes: 60,
        attendance: 3,
      }),
    ).resolves.toEqual([
      {
        date: "2030-08-12",
        startTime: "10:30",
        endTime: "11:30",
        status: "available",
        remaining: 5,
      },
    ]);

    expect(String(request.mock.calls[0]?.[0])).toBe(
      "http://localhost:4000/api/v1/availability/ordinary?date=2030-08-12&durationMinutes=60&attendance=3",
    );
  });

  it("surfaces the API error instead of treating a failed request as no availability", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            success: false,
            error: {
              code: "STUDIO_CLOSED",
              message: "The studio is closed on this date",
            },
          },
          { status: 400 },
        ),
      ),
    );

    await expect(
      getOrdinaryAvailability({
        date: "2030-08-12",
        durationMinutes: 30,
        attendance: 2,
      }),
    ).rejects.toMatchObject({
      code: "STUDIO_CLOSED",
      message: "The studio is closed on this date",
    });
  });
});

describe("getPartyAvailability", () => {
  it("requests generated candidate starts for the selected package duration", async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json({
          success: true,
          data: [
            {
              date: "2030-08-12",
              startTime: "12:00",
              endTime: "13:30",
              request_only: true,
            },
          ],
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(
      getPartyAvailability({
        date: "2030-08-12",
        guestDurationMinutes: 90,
      }),
    ).resolves.toEqual([
      {
        date: "2030-08-12",
        startTime: "12:00",
        endTime: "13:30",
        request_only: true,
      },
    ]);
    expect(String(request.mock.calls[0]?.[0])).toBe(
      "http://localhost:4000/api/v1/availability/party?date=2030-08-12&guestDurationMinutes=90",
    );
  });
});
