import { describe, expect, it } from "vitest";
import { ApiClientError } from "../api/base";
import {
  formatBookingActionError,
  bookingActionsFor,
  melbourneLocalToIso,
  isStaleBookingStatus,
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
    const conflict = new ApiClientError(
      "The request changed. Refresh and try again.",
      "STATUS_CONFLICT",
      409,
      { currentStatus: "cancelled" },
    );
    expect(formatBookingActionError(conflict)).toBe(
      "记录已被其他操作更新，请查看最新状态",
    );
    expect(isStaleBookingStatus(conflict)).toBe(true);
    expect(formatBookingActionError(new Error("socket hang up"))).toBe(
      "状态更新失败，请稍后重试",
    );
    expect(isStaleBookingStatus(new Error("socket hang up"))).toBe(false);
  });

  it.each([
    [
      new ApiClientError(
        "startTime must align to a 30-minute interval",
        "VALIDATION_ERROR",
        400,
      ),
      "开始时间必须选择整点或半点",
    ],
    [
      new ApiClientError(
        "The studio is closed on this date",
        "STUDIO_CLOSED",
        400,
      ),
      "所选日期门店不营业，请选择其他日期",
    ],
    [
      new ApiClientError(
        "The party time is unavailable due to the studio schedule",
        "SCHEDULE_CONFLICT",
        409,
      ),
      "所选时段与门店日程冲突，请选择其他时段",
    ],
    [
      new ApiClientError(
        "The requested interval is already held",
        "CAPACITY_CONFLICT",
        409,
      ),
      "所选时段已被占用或容量不足，请选择其他时段",
    ],
  ])("shows an actionable Chinese booking error for %s", (error, expected) => {
    expect(formatBookingActionError(error)).toBe(expected);
  });

  it("returns action-specific controls instead of a generic state list", () => {
    expect(bookingActionsFor("experience", "pending_review")).toEqual([
      "confirm",
      "waitlist",
      "reject",
    ]);
    expect(bookingActionsFor("experience", "confirmed")).toEqual([
      "complete",
      "no_show",
      "cancel",
    ]);
    expect(bookingActionsFor("party", "awaiting_in_store_payment")).toEqual([
      "record_payment",
      "cancel",
    ]);
  });

  it("converts operational timestamps in Australia/Melbourne across DST", () => {
    expect(melbourneLocalToIso("2026-08-01T10:00")).toBe(
      "2026-08-01T00:00:00.000Z",
    );
    expect(melbourneLocalToIso("2026-01-15T10:00")).toBe(
      "2026-01-14T23:00:00.000Z",
    );
  });
});
