import { describe, expect, it } from "vitest";
import { selectClosureBookingDate } from "../e2e/fixtures/closure-database";

describe("selectClosureBookingDate", () => {
  it("keeps a Monday-created fixture within the seven-day booking horizon", () => {
    expect(selectClosureBookingDate(new Date("2026-08-03T00:00:00.000Z"))).toBe(
      "2026-08-06",
    );
  });

  it("keeps a Tuesday-created fixture within the seven-day booking horizon", () => {
    expect(selectClosureBookingDate(new Date("2026-08-04T00:00:00.000Z"))).toBe(
      "2026-08-07",
    );
  });
});
