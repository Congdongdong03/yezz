import { describe, expect, it } from "vitest";
import { ApiClientError } from "../api/base";
import {
  formatBookingActionError,
  requiresCustomerNote,
} from "./booking-status";

describe("requiresCustomerNote", () => {
  it("requires a customer note when a booking is confirmed", () => {
    expect(requiresCustomerNote("confirmed")).toBe(true);
  });

  it("requires a customer note when a booking is cancelled", () => {
    expect(requiresCustomerNote("cancelled")).toBe(true);
  });

  it("does not require a customer note for a pending booking", () => {
    expect(requiresCustomerNote("new")).toBe(false);
  });

  it("localizes stale status conflicts and hides raw transport errors", () => {
    expect(
      formatBookingActionError(
        new ApiClientError(
          "The request changed. Refresh and try again.",
          "STATUS_CONFLICT",
          409,
        ),
      ),
    ).toBe("预约状态已变化，请刷新后重试");
    expect(formatBookingActionError(new Error("socket hang up"))).toBe(
      "状态更新失败，请稍后重试",
    );
  });
});
