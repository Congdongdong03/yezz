import { AppError } from "./errors.js";

export const MELBOURNE_TIME_ZONE = "Australia/Melbourne";
export const BOOKING_HORIZON_CALENDAR_DAYS = 7;
export const MINIMUM_LEAD_MINUTES = 120;
export const START_INCREMENT_MINUTES = 30;
export const ORDINARY_CAPACITY = 8;

export type MelbourneClock = {
  date: string;
  minuteOfDay: number;
};

export type BookingWindowInput = {
  date: string;
  startTime: string;
  durationMinutes: 30 | 60 | 90 | 150;
};

export type OperatingHours = {
  opensAt: string;
  closesAt: string;
};

const HH_MM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;
const ALLOWED_DURATIONS = new Set<BookingWindowInput["durationMinutes"]>([
  30,
  60,
  90,
  150,
]);

function validationError(message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", message);
}

export function parseCalendarDate(date: string): {
  ordinal: number;
  weekday: number;
} {
  const match = ISO_DATE.exec(date);
  if (!match) throw validationError("date must use YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day
  ) {
    throw validationError("date is invalid");
  }
  return {
    ordinal: Math.floor(instant.getTime() / MILLISECONDS_PER_DAY),
    weekday: instant.getUTCDay(),
  };
}

function minutes(value: string): number {
  if (!HH_MM.test(value)) {
    throw validationError("time must use HH:MM");
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minuteOfDay: number): string {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(
    minuteOfDay % 60,
  ).padStart(2, "0")}`;
}

export function getMelbourneClock(now: Date): MelbourneClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    minuteOfDay: Number(value.hour) * 60 + Number(value.minute),
  };
}

export function validateBookingWindow(
  input: BookingWindowInput,
  clock: MelbourneClock,
  hours: OperatingHours,
): void {
  const candidate = parseCalendarDate(input.date);
  const today = parseCalendarDate(clock.date);
  const start = minutes(input.startTime);
  const opensAt = minutes(hours.opensAt);
  const closesAt = minutes(hours.closesAt);

  if (!ALLOWED_DURATIONS.has(input.durationMinutes)) {
    throw validationError("durationMinutes is not supported");
  }
  if (start % START_INCREMENT_MINUTES !== 0) {
    throw validationError("startTime must align to a 30-minute interval");
  }
  if (candidate.ordinal < today.ordinal) {
    throw validationError("date is in the past in Australia/Melbourne");
  }
  if (candidate.ordinal - today.ordinal > BOOKING_HORIZON_CALENDAR_DAYS) {
    throw validationError("date must be within seven calendar days");
  }
  if (start < opensAt || start + input.durationMinutes > closesAt) {
    throw validationError("booking must finish by closing time");
  }
  if (
    candidate.ordinal === today.ordinal &&
    start - clock.minuteOfDay < MINIMUM_LEAD_MINUTES
  ) {
    throw validationError("same-day bookings require two hours lead time");
  }
}

export function generateThirtyMinuteStarts(input: {
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
}): string[] {
  const opensAt = minutes(input.opensAt);
  const closesAt = minutes(input.closesAt);
  const starts: string[] = [];
  for (
    let start = Math.ceil(opensAt / START_INCREMENT_MINUTES) * START_INCREMENT_MINUTES;
    start + input.durationMinutes <= closesAt;
    start += START_INCREMENT_MINUTES
  ) {
    starts.push(formatTime(start));
  }
  return starts;
}
