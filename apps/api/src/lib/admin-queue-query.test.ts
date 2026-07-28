import { describe, expect, it } from "vitest";
import { parseAdminQueueQuery } from "./admin-queue-query.js";

describe("parseAdminQueueQuery", () => {
  it("normalizes malformed values while retaining valid filters", () => {
    expect(
      parseAdminQueueQuery({
        page: "1.5",
        status: "unknown",
        search: `  Alice ${"x".repeat(250)}  `,
        unread: "yes",
        overdue: "true",
        confirmedToday: "false",
      }),
    ).toEqual({
      page: 1,
      status: undefined,
      search: `Alice ${"x".repeat(194)}`,
      unreadOnly: false,
      overdue: true,
      confirmedToday: false,
    });
  });

  it("defaults infinite, fractional, zero, and unknown query values safely", () => {
    for (const page of ["Infinity", "NaN", "0", "-1", "3.2", undefined]) {
      expect(parseAdminQueueQuery({ page }).page).toBe(1);
    }
  });
});
