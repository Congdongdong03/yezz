import { describe, expect, it } from "vitest";
import {
  MELBOURNE_TIME_ZONE,
  assertSlotAllowed,
  getMelbourneDate,
} from "./slot-policy.js";

describe("slot policy", () => {
  const now = new Date("2026-07-28T00:00:00+10:00");

  it.each([
    ["2026-07-27", "10:00", "11:00", "past"],
    ["2026-07-30", "08:30", "09:30", "outside business hours"],
    ["2026-07-30", "11:00", "10:00", "end must be after start"],
  ])("rejects %s %s-%s when it is %s", (date, startTime, endTime) => {
    expect(() =>
      assertSlotAllowed({ date, startTime, endTime, capacity: 2 }, now),
    ).toThrow();
  });

  it.each([
    ["2026-07-27", "09:30", "17:00"],
    ["2026-07-28", "09:30", "17:00"],
    ["2026-07-29", "09:30", "17:00"],
    ["2026-07-30", "09:30", "20:30"],
    ["2026-07-31", "09:30", "20:30"],
    ["2026-08-01", "09:30", "17:30"],
    ["2026-08-02", "10:00", "17:00"],
  ])("accepts the approved hours on %s", (date, startTime, endTime) => {
    const referenceNow = new Date("2026-07-26T00:00:00+10:00");
    expect(() =>
      assertSlotAllowed(
        { date, startTime, endTime, capacity: 1 },
        referenceNow,
      ),
    ).not.toThrow();
  });

  it("allows the inclusive 365-day horizon and rejects the next day", () => {
    expect(() =>
      assertSlotAllowed(
        {
          date: "2027-07-28",
          startTime: "09:30",
          endTime: "10:30",
          capacity: 1,
        },
        now,
      ),
    ).not.toThrow();

    expect(() =>
      assertSlotAllowed(
        {
          date: "2027-07-29",
          startTime: "09:30",
          endTime: "10:30",
          capacity: 1,
        },
        now,
      ),
    ).toThrowError(/365/);
  });

  it.each([
    [new Date("2026-10-03T14:30:00.000Z"), "2026-10-04"],
    [new Date("2027-04-03T13:30:00.000Z"), "2027-04-04"],
  ])(
    "derives the Melbourne date through DST boundary %s",
    (instant, expectedDate) => {
      expect(getMelbourneDate(instant)).toBe(expectedDate);
      expect(MELBOURNE_TIME_ZONE).toBe("Australia/Melbourne");
    },
  );

  it.each<[string, string, string, string, number]>([
    ["2026-02-30", "09:30", "10:30", "invalid date", 1],
    ["2026-07-30", "9:30", "10:30", "invalid time", 1],
    ["2026-07-30", "09:30", "09:30", "end must be after start", 1],
    ["2026-07-30", "09:30", "10:30", "capacity", 0],
  ])(
    "rejects malformed or impossible input: %s %s",
    (date, startTime, endTime, _reason, capacity) => {
      expect(() =>
        assertSlotAllowed({ date, startTime, endTime, capacity }, now),
      ).toThrow();
    },
  );
});
