import { describe, expect, it } from "vitest";
import { parseBookingManagementBaseUrl } from "./booking-notification-config.js";

describe("parseBookingManagementBaseUrl", () => {
  it.each(["https://yezyy.com?", "https://yezyy.com#"])(
    "rejects a production URL with a raw empty query or fragment marker: %s",
    (value) => {
      expect(parseBookingManagementBaseUrl(value, true)).toBeNull();
    },
  );

  it.each(["https://yezyy.com", "https://yezyy.com/"])(
    "accepts canonical raw production origins: %s",
    (value) => {
      expect(parseBookingManagementBaseUrl(value, true)?.toString()).toBe(
        "https://yezyy.com/",
      );
    },
  );
});
