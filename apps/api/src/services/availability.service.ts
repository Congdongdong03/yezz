import type { Db } from "@yezz/db";
import {
  ORDINARY_CAPACITY,
  MINIMUM_LEAD_MINUTES,
  generateThirtyMinuteStarts,
  getMelbourneClock,
  validateBookingDate,
  validateBookingSlot,
  validateSupportedDuration,
  type BookingWindowInput,
} from "../lib/booking-policy.js";
import { AppError } from "../lib/errors.js";
import {
  createBookingAvailabilityRepository,
  type BookingAvailabilityRepository,
  type LocalInterval,
} from "../repositories/booking-availability.repository.js";
import {
  createStudioScheduleRepository,
  type ResolvedStudioDay,
} from "../repositories/studio-schedule.repository.js";

export type AvailabilitySlot = {
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "waitlist";
  remaining: number;
};

export type PartyCandidateSlot = {
  date: string;
  startTime: string;
  endTime: string;
  request_only: true;
};

type ScheduleRepository = ReturnType<typeof createStudioScheduleRepository>;
type OrdinaryInput = {
  date: string;
  durationMinutes: 30 | 60;
  attendance: number;
};
type PartyInput = {
  date: string;
  guestDurationMinutes: BookingWindowInput["durationMinutes"];
};

function minutes(time: string): number {
  const [hours, minute] = time.split(":").map(Number);
  return hours * 60 + minute;
}

function endTime(startTime: string, durationMinutes: number): string {
  const end = minutes(startTime) + durationMinutes;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(
    end % 60,
  ).padStart(2, "0")}`;
}

function overlapsClosure(
  interval: LocalInterval,
  closures: ResolvedStudioDay["closures"],
): boolean {
  return closures.some(
    (closure) =>
      closure.startTime === null ||
      closure.endTime === null ||
      (interval.startTime < closure.endTime && interval.endTime > closure.startTime),
  );
}

function requireOpenHours(schedule: ResolvedStudioDay): {
  opensAt: string;
  closesAt: string;
} {
  if (schedule.isClosed || !schedule.opensAt || !schedule.closesAt) {
    throw new AppError(400, "STUDIO_CLOSED", "The studio is closed on this date");
  }
  return { opensAt: schedule.opensAt, closesAt: schedule.closesAt };
}

function requireAttendance(attendance: number): void {
  if (!Number.isInteger(attendance) || attendance < 1 || attendance > ORDINARY_CAPACITY) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `attendance must be an integer from 1 to ${ORDINARY_CAPACITY}`,
    );
  }
}

function isInsideSameDayLeadTime(
  date: string,
  startTime: string,
  clock: { date: string; minuteOfDay: number },
): boolean {
  return (
    date === clock.date &&
    minutes(startTime) - clock.minuteOfDay < MINIMUM_LEAD_MINUTES
  );
}

export type AvailabilityService = ReturnType<typeof createAvailabilityService>;

export function createAvailabilityService(
  db: Db,
  dependencies?: {
    now?: () => Date;
    schedule?: ScheduleRepository;
    availability?: BookingAvailabilityRepository;
  },
) {
  const now = dependencies?.now ?? (() => new Date());
  const scheduleRepository =
    dependencies?.schedule ?? createStudioScheduleRepository(db);
  const availabilityRepository =
    dependencies?.availability ?? createBookingAvailabilityRepository(db);

  return {
    async listOrdinary(input: OrdinaryInput): Promise<AvailabilitySlot[]> {
      const clock = getMelbourneClock(now());
      validateBookingDate(input.date, clock);
      requireAttendance(input.attendance);
      if (input.durationMinutes !== 30 && input.durationMinutes !== 60) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "durationMinutes must be 30 or 60",
        );
      }
      const schedule = await scheduleRepository.resolveDay(input.date);
      const hours = requireOpenHours(schedule);
      const starts = generateThirtyMinuteStarts({
        ...hours,
        durationMinutes: input.durationMinutes,
      });
      const slots: AvailabilitySlot[] = [];

      for (const startTime of starts) {
        if (isInsideSameDayLeadTime(input.date, startTime, clock)) continue;
        validateBookingSlot(
          { date: input.date, startTime, durationMinutes: input.durationMinutes },
          clock,
          hours,
        );
        const interval = {
          date: input.date,
          startTime,
          endTime: endTime(startTime, input.durationMinutes),
        };
        if (overlapsClosure(interval, schedule.closures)) continue;
        const occupied = await availabilityRepository.sumConfirmedAttendance(interval);
        const remaining = Math.max(0, ORDINARY_CAPACITY - occupied);
        slots.push({
          ...interval,
          status: remaining >= input.attendance ? "available" : "waitlist",
          remaining,
        });
      }
      return slots;
    },

    async listPartyCandidates(input: PartyInput): Promise<PartyCandidateSlot[]> {
      const clock = getMelbourneClock(now());
      validateBookingDate(input.date, clock);
      validateSupportedDuration(input.guestDurationMinutes);
      const schedule = await scheduleRepository.resolveDay(input.date);
      const hours = requireOpenHours(schedule);
      const starts = generateThirtyMinuteStarts({
        ...hours,
        durationMinutes: input.guestDurationMinutes,
      });
      const slots: PartyCandidateSlot[] = [];

      for (const startTime of starts) {
        if (isInsideSameDayLeadTime(input.date, startTime, clock)) continue;
        validateBookingSlot(
          {
            date: input.date,
            startTime,
            durationMinutes: input.guestDurationMinutes,
          },
          clock,
          hours,
        );
        const interval = {
          date: input.date,
          startTime,
          endTime: endTime(startTime, input.guestDurationMinutes),
        };
        if (overlapsClosure(interval, schedule.closures)) continue;
        if (await availabilityRepository.hasExclusivePartyOverlap(interval)) continue;
        slots.push({ ...interval, request_only: true });
      }
      return slots;
    },
  };
}
