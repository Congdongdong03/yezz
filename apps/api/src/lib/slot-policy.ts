import { AppError } from "./errors.js";

export const MELBOURNE_TIME_ZONE = "Australia/Melbourne";
export const BOOKING_HORIZON_DAYS = 365;

export type SlotPolicyInput = {
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MILLISECONDS_PER_DAY = 86_400_000;

const WEEKLY_HOURS: Readonly<
  Record<number, Readonly<{ opens: string; closes: string }>>
> = {
  0: { opens: "10:00", closes: "17:00" },
  1: { opens: "09:30", closes: "17:00" },
  2: { opens: "09:30", closes: "17:00" },
  3: { opens: "09:30", closes: "17:00" },
  4: { opens: "09:30", closes: "20:30" },
  5: { opens: "09:30", closes: "20:30" },
  6: { opens: "09:30", closes: "17:30" },
};

function validationError(message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", message);
}

export function parseCalendarDate(date: string): {
  ordinal: number;
  weekday: number;
} {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw validationError("date must use YYYY-MM-DD");
  }
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

export function getMelbourneDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function assertSlotAllowed(input: SlotPolicyInput, now: Date): void {
  const slotDate = parseCalendarDate(input.date);
  const today = parseCalendarDate(getMelbourneDate(now));

  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw validationError("capacity must be a positive integer");
  }
  if (!HH_MM.test(input.startTime) || !HH_MM.test(input.endTime)) {
    throw validationError("startTime and endTime must use HH:MM");
  }
  if (input.startTime >= input.endTime) {
    throw validationError("end must be after start");
  }
  if (slotDate.ordinal < today.ordinal) {
    throw validationError("date is in the past in Australia/Melbourne");
  }
  if (slotDate.ordinal - today.ordinal > BOOKING_HORIZON_DAYS) {
    throw validationError(
      `date must be within the ${BOOKING_HORIZON_DAYS}-day booking horizon`,
    );
  }

  const hours = WEEKLY_HOURS[slotDate.weekday];
  if (input.startTime < hours.opens || input.endTime > hours.closes) {
    throw validationError(
      `slot must be within business hours ${hours.opens}-${hours.closes}`,
    );
  }
}
