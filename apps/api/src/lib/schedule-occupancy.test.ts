import { describe, expect, it } from "vitest";
import { occupiesStudioSchedule } from "./schedule-occupancy.js";

describe("schedule occupancy policy", () => {
  it.each([
    ["experience", "confirmed", true],
    ["experience", "cancellation_requested", true],
    ["experience", "reschedule_requested", true],
    ["party", "awaiting_in_store_payment", true],
    ["party", "confirmed_paid", true],
    ["party", "confirmed", true],
    ["party", "cancellation_requested", true],
    ["party", "reschedule_requested", true],
    ["experience", "cancelled", false],
    ["party", "payment_expired", false],
  ])("treats %s/%s as occupying=%s", (requestKind, status, expected) => {
    expect(occupiesStudioSchedule(requestKind, status)).toBe(expected);
  });
});
