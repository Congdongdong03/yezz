import { afterEach, describe, expect, it } from "vitest";
import { customerManageUrl, staffBookingUrl } from "./booking-notification.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("booking management URLs", () => {
  it("retains the local default outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(customerManageUrl("en", "token")).toBe(
      "http://localhost:3000/en/manage-booking/token",
    );
  });

  it.each([
    undefined,
    "http://yezyy.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://0.0.0.0",
    "https://[::1]",
  ])("rejects an unsafe production origin %s", (configuredBaseUrl) => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(() =>
      customerManageUrl("en", "token", configuredBaseUrl),
    ).toThrow(
      expect.objectContaining({ code: "CUSTOMER_MANAGE_URL_UNAVAILABLE" }),
    );
  });

  it("builds customer and staff links from a safe production origin", () => {
    process.env.NODE_ENV = "production";

    expect(customerManageUrl("zh", "token", "https://yezyy.com")).toBe(
      "https://yezyy.com/zh/manage-booking/token",
    );
    expect(
      staffBookingUrl(
        "00000000-0000-4000-8000-000000000001",
        "https://yezyy.com",
      ),
    ).toBe(
      "https://yezyy.com/admin/bookings/00000000-0000-4000-8000-000000000001",
    );
  });
});
