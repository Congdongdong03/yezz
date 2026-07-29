import { describe, expect, it } from "vitest";
import {
  generateThirtyMinuteStarts,
  getMelbourneClock,
  validateBookingWindow,
} from "./booking-policy.js";

describe("booking policy", () => {
  it("allows only the current Melbourne date through seven calendar days", () => {
    const clock = { date: "2026-07-29", minuteOfDay: 10 * 60 };
    expect(() =>
      validateBookingWindow(
        { date: "2026-08-05", startTime: "12:00", durationMinutes: 60 },
        clock,
        { opensAt: "09:30", closesAt: "17:00" },
      ),
    ).not.toThrow();
    expect(() =>
      validateBookingWindow(
        { date: "2026-08-06", startTime: "12:00", durationMinutes: 60 },
        clock,
        { opensAt: "09:30", closesAt: "17:00" },
      ),
    ).toThrowError(/seven calendar days/);
  });

  it("requires two hours and completion by close", () => {
    const clock = { date: "2026-07-29", minuteOfDay: 14 * 60 };
    expect(() =>
      validateBookingWindow(
        { date: "2026-07-29", startTime: "15:30", durationMinutes: 60 },
        clock,
        { opensAt: "09:30", closesAt: "17:00" },
      ),
    ).toThrowError(/two hours/);
    expect(() =>
      validateBookingWindow(
        { date: "2026-07-29", startTime: "16:30", durationMinutes: 60 },
        { ...clock, minuteOfDay: 9 * 60 },
        { opensAt: "09:30", closesAt: "17:00" },
      ),
    ).toThrowError(/closing/);
  });

  it("uses Melbourne local time through the DST boundary", () => {
    expect(getMelbourneClock(new Date("2026-10-03T14:30:00.000Z"))).toEqual({
      date: "2026-10-04",
      minuteOfDay: 30,
    });
  });

  it("generates half-hour starts that fit the requested duration", () => {
    expect(
      generateThirtyMinuteStarts({
        opensAt: "09:30",
        closesAt: "11:00",
        durationMinutes: 60,
      }),
    ).toEqual(["09:30", "10:00"]);
  });

  it("rounds an unusual opening time up to the next valid start increment", () => {
    expect(
      generateThirtyMinuteStarts({
        opensAt: "09:45",
        closesAt: "11:00",
        durationMinutes: 60,
      }),
    ).toEqual(["10:00"]);
  });
});
