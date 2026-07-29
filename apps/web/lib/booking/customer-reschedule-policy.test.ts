import { describe, expect, it } from "vitest";
import {
  getCustomerRescheduleDateBounds,
  validateCustomerRescheduleRequest,
} from "./customer-reschedule-policy";

describe("customer reschedule policy", () => {
  const now = new Date("2030-08-12T00:00:00.000Z"); // 10:00 in Melbourne

  it("exposes Melbourne calendar bounds from today through seven days", () => {
    expect(getCustomerRescheduleDateBounds(now)).toEqual({
      min: "2030-08-12",
      max: "2030-08-19",
    });
  });

  it.each([
    ["past date", "2030-08-11", "13:30"],
    ["eighth calendar day", "2030-08-20", "13:30"],
    ["119-minute lead", "2030-08-12", "11:59"],
    ["invalid calendar date", "2030-02-30", "13:30"],
    ["non-30-minute start", "2030-08-12", "12:15"],
  ])("rejects %s", (_case, date, startTime) => {
    expect(validateCustomerRescheduleRequest({ date, startTime }, now)).toEqual({
      valid: false,
    });
  });

  it.each([
    ["exactly two hours", "2030-08-12", "12:00"],
    ["exactly seven calendar days", "2030-08-19", "13:30"],
  ])("accepts %s", (_case, date, startTime) => {
    expect(validateCustomerRescheduleRequest({ date, startTime }, now)).toEqual({
      valid: true,
    });
  });

  it("measures lead time across Melbourne's spring-forward transition", () => {
    const beforeSpringForward = new Date("2026-10-03T15:30:00.000Z");

    expect(
      validateCustomerRescheduleRequest(
        { date: "2026-10-04", startTime: "03:30" },
        beforeSpringForward,
      ),
    ).toEqual({ valid: false });
    expect(
      validateCustomerRescheduleRequest(
        { date: "2026-10-04", startTime: "04:30" },
        beforeSpringForward,
      ),
    ).toEqual({ valid: true });
  });

  it("measures lead time across Melbourne's fall-back transition", () => {
    const beforeFallBack = new Date("2027-04-03T15:30:00.000Z");

    expect(
      validateCustomerRescheduleRequest(
        { date: "2027-04-04", startTime: "03:00" },
        beforeFallBack,
      ),
    ).toEqual({ valid: false });
    expect(
      validateCustomerRescheduleRequest(
        { date: "2027-04-04", startTime: "03:30" },
        beforeFallBack,
      ),
    ).toEqual({ valid: true });
  });
});
