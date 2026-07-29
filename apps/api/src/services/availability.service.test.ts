import { describe, expect, it } from "vitest";
import { createAvailabilityService } from "./availability.service.js";

describe("availability service", () => {
  const schedule = {
    resolveDay: async () => ({
      date: "2026-07-30",
      isClosed: false,
      opensAt: "09:30",
      closesAt: "11:30",
      closures: [{ startTime: "10:30", endTime: "11:00" }],
    }),
  };

  it("marks generated ordinary slots waitlist when confirmed attendance leaves too little capacity", async () => {
    const service = createAvailabilityService(null as never, {
      now: () => new Date("2026-07-29T00:00:00.000Z"),
      schedule,
      availability: {
        sumConfirmedAttendance: async () => 6,
        hasExclusivePartyOverlap: async () => false,
        lockOperationalDate: async () => undefined,
      },
    });

    await expect(
      service.listOrdinary({ date: "2026-07-30", durationMinutes: 60, attendance: 3 }),
    ).resolves.toEqual([
      {
        date: "2026-07-30",
        startTime: "09:30",
        endTime: "10:30",
        status: "waitlist",
        remaining: 2,
      },
    ]);
  });

  it("omits ordinary slots occupied by an active exclusive party", async () => {
    const service = createAvailabilityService(null as never, {
      now: () => new Date("2026-07-29T00:00:00.000Z"),
      schedule: {
        resolveDay: async () => ({
          date: "2026-07-30",
          isClosed: false,
          opensAt: "09:30",
          closesAt: "11:00",
          closures: [],
        }),
      },
      availability: {
        sumConfirmedAttendance: async () => 0,
        hasExclusivePartyOverlap: async (interval) => interval.startTime === "09:30",
        lockOperationalDate: async () => undefined,
      },
    });

    await expect(
      service.listOrdinary({ date: "2026-07-30", durationMinutes: 60, attendance: 1 }),
    ).resolves.toEqual([
      {
        date: "2026-07-30",
        startTime: "10:00",
        endTime: "11:00",
        status: "available",
        remaining: 8,
      },
    ]);
  });

  it("returns only non-conflicting party candidates as request-only", async () => {
    const service = createAvailabilityService(null as never, {
      now: () => new Date("2026-07-29T00:00:00.000Z"),
      schedule: {
        resolveDay: async () => ({
          date: "2026-07-30",
          isClosed: false,
          opensAt: "09:30",
          closesAt: "11:00",
          closures: [],
        }),
      },
      availability: {
        sumConfirmedAttendance: async () => 0,
        hasExclusivePartyOverlap: async (interval) => interval.startTime === "09:30",
        lockOperationalDate: async () => undefined,
      },
    });

    await expect(
      service.listPartyCandidates({ date: "2026-07-30", guestDurationMinutes: 60 }),
    ).resolves.toEqual([
      {
        date: "2026-07-30",
        startTime: "10:00",
        endTime: "11:00",
        request_only: true,
      },
    ]);
  });

  it("omits same-day starts inside the two-hour lead time", async () => {
    const service = createAvailabilityService(null as never, {
      now: () => new Date("2026-07-29T00:00:00.000Z"),
      schedule: {
        resolveDay: async () => ({
          date: "2026-07-29",
          isClosed: false,
          opensAt: "10:00",
          closesAt: "14:00",
          closures: [],
        }),
      },
      availability: {
        sumConfirmedAttendance: async () => 0,
        hasExclusivePartyOverlap: async () => false,
        lockOperationalDate: async () => undefined,
      },
    });

    await expect(
      service.listOrdinary({ date: "2026-07-29", durationMinutes: 60, attendance: 1 }),
    ).resolves.toMatchObject([
      { startTime: "12:00" },
      { startTime: "12:30" },
      { startTime: "13:00" },
    ]);
  });

  it("rejects an unsupported ordinary duration at the service boundary", async () => {
    const service = createAvailabilityService(null as never, {
      schedule,
      availability: {
        sumConfirmedAttendance: async () => 0,
        hasExclusivePartyOverlap: async () => false,
        lockOperationalDate: async () => undefined,
      },
    });

    await expect(
      service.listOrdinary({
        date: "2026-07-30",
        durationMinutes: 90 as never,
        attendance: 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects an out-of-horizon closed day before checking the schedule", async () => {
    const service = createAvailabilityService(null as never, {
      now: () => new Date("2026-07-29T00:00:00.000Z"),
      schedule: {
        resolveDay: async () => ({
          date: "2026-08-06",
          isClosed: true,
          opensAt: null,
          closesAt: null,
          closures: [],
        }),
      },
    });

    await expect(
      service.listOrdinary({ date: "2026-08-06", durationMinutes: 60, attendance: 1 }),
    ).rejects.toThrow(/seven calendar days/);
  });

  it("rejects an out-of-horizon day even when its hours cannot generate a slot", async () => {
    const service = createAvailabilityService(null as never, {
      now: () => new Date("2026-07-29T00:00:00.000Z"),
      schedule: {
        resolveDay: async () => ({
          date: "2026-08-06",
          isClosed: false,
          opensAt: "09:30",
          closesAt: "10:00",
          closures: [],
        }),
      },
    });

    await expect(
      service.listOrdinary({ date: "2026-08-06", durationMinutes: 60, attendance: 1 }),
    ).rejects.toThrow(/seven calendar days/);
  });

  it("rejects an unsupported party duration before generating slots", async () => {
    const service = createAvailabilityService(null as never, {
      now: () => new Date("2026-07-29T00:00:00.000Z"),
      schedule: {
        resolveDay: async () => ({
          date: "2026-07-30",
          isClosed: false,
          opensAt: "09:30",
          closesAt: "10:00",
          closures: [],
        }),
      },
    });

    await expect(
      service.listPartyCandidates({
        date: "2026-07-30",
        guestDurationMinutes: 45 as never,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
