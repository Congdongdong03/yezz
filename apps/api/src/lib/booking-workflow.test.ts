import { describe, expect, it } from "vitest";
import {
  ORDINARY_TRANSITIONS,
  buildOrdinaryInterval,
  validateOrdinaryAttendance,
} from "./booking-workflow.js";

describe("ordinary booking workflow", () => {
  it("derives physical attendance and the longest selected duration", () => {
    expect(
      buildOrdinaryInterval({
        date: "2026-07-30",
        startTime: "10:00",
        participantCount: 2,
        accompanyingAdultCount: 1,
        itemDurations: [30, 60],
      }),
    ).toEqual({
      date: "2026-07-30",
      startTime: "10:00",
      endTime: "11:00",
      attendanceCount: 3,
      durationMinutes: 60,
    });
  });

  it("requires an accompanying adult when a four-to-eight-year-old attends", () => {
    expect(() =>
      validateOrdinaryAttendance({
        participantCount: 2,
        youngChildCount: 1,
        accompanyingAdultCount: 0,
      }),
    ).toThrow(/accompanying adult/i);
  });

  it("limits total physical attendance to eight", () => {
    expect(() =>
      validateOrdinaryAttendance({
        participantCount: 7,
        youngChildCount: 0,
        accompanyingAdultCount: 2,
      }),
    ).toThrow(/attendance/i);
  });

  it("allows staff to confirm pending or waitlisted requests only", () => {
    expect(ORDINARY_TRANSITIONS.pending_review).toContain("confirmed");
    expect(ORDINARY_TRANSITIONS.waitlisted).toContain("confirmed");
    expect(ORDINARY_TRANSITIONS.rejected).toEqual([]);
  });
});
