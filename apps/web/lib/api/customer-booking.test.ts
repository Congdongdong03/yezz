import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptProposedTime,
  getCustomerBooking,
  requestCustomerCancellation,
  requestCustomerReschedule,
} from "./customer-booking";

const TOKEN = "A".repeat(43);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function safeView() {
  return {
    kind: "party",
    status: "time_proposed",
    locale: "en",
    offeringLabel: "Standard party",
    date: "2030-08-12",
    startTime: "12:00",
    endTime: "13:30",
    allowedActions: ["accept_time"],
    proposedTime: {
      date: "2030-08-13",
      startTime: "12:30",
      endTime: "14:00",
    },
  };
}

describe("customer booking API", () => {
  it("server-loads the safe read model through a no-store BFF path", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json({ success: true, data: safeView() });
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(getCustomerBooking(TOKEN)).resolves.toEqual(safeView());
    expect(String(request.mock.calls[0]?.[0])).toBe(
      `https://yezyy.com/api/backend/v1/customer-bookings/${TOKEN}`,
    );
    expect(request.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
    expect(String(request.mock.calls[0]?.[0])).not.toContain("?");
  });

  it("does not send an unconfigured local server render to the live customer endpoint", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json({ success: true, data: safeView() });
      },
    );
    vi.stubGlobal("fetch", request);

    await getCustomerBooking(TOKEN);

    expect(String(request.mock.calls[0]?.[0])).toBe(
      `http://localhost:3000/api/backend/v1/customer-bookings/${TOKEN}`,
    );
  });

  it.each([
    ["unknown", 404, "LINK_INVALID_OR_EXPIRED"],
    ["wrong scope", 403, "CUSTOMER_ACTION_FORBIDDEN"],
    ["wrong state", 409, "STATUS_CONFLICT"],
  ])("keeps %s failures behind one typed client error", async (_name, status, code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            success: false,
            error: { code, message: "Internal detail must not render" },
          },
          { status },
        ),
      ),
    );

    await expect(getCustomerBooking(TOKEN)).rejects.toMatchObject({
      code,
      status,
    });
  });

  it("posts each allowed action with the token only in the BFF route path", async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json({
          success: true,
          data: { status: "cancellation_requested" },
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await acceptProposedTime(TOKEN);
    await requestCustomerCancellation(TOKEN);
    await requestCustomerReschedule(TOKEN, {
      date: "2030-08-14",
      startTime: "13:30",
    });

    expect(
      request.mock.calls.map(([input]) => String(input)),
    ).toEqual([
      `/api/backend/v1/customer-bookings/${TOKEN}/accept-time`,
      `/api/backend/v1/customer-bookings/${TOKEN}/request-cancellation`,
      `/api/backend/v1/customer-bookings/${TOKEN}/request-reschedule`,
    ]);
    expect(
      request.mock.calls.map(([, init]) => init?.method),
    ).toEqual(["POST", "POST", "POST"]);
    expect(request.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(request.mock.calls[1]?.[1]?.body).toBeUndefined();
    expect(JSON.parse(String(request.mock.calls[2]?.[1]?.body))).toEqual({
      date: "2030-08-14",
      startTime: "13:30",
    });
    expect(
      request.mock.calls
        .map(([, init]) => String(init?.body ?? ""))
        .join(""),
    ).not.toContain(TOKEN);
  });
});
