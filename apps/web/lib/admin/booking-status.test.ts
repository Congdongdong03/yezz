import { describe, expect, it } from "vitest";
import { requiresCustomerNote } from "./booking-status";

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
});
