import type { BookingStatus } from "@yezz/db";
import { CURRENT_BOOKING_POLICY_VERSION } from "./booking-policy-version.js";
import { AppError } from "./errors.js";
import type { PhotoConsentInput } from "./photo-consent.js";

export type OrdinaryBookingItemInput =
  | { projectId: string; quantity: number; decideInStore?: false }
  | { projectId?: never; quantity: number; decideInStore: true };

export type OrdinaryBookingCreateInput = {
  kind: "experience";
  mode: "booking" | "waitlist";
  name: string;
  phone: string;
  email: string;
  date: string;
  startTime: string;
  participantCount: number;
  youngChildCount: number;
  accompanyingAdultCount: number;
  items: OrdinaryBookingItemInput[];
  message?: string;
  locale: "en" | "zh";
  policyVersion: typeof CURRENT_BOOKING_POLICY_VERSION;
  policyAccepted: true;
  photoConsent?: PhotoConsentInput;
};

export const ORDINARY_TRANSITIONS = {
  pending_review: ["confirmed", "waitlisted", "rejected", "cancelled"],
  waitlisted: ["confirmed", "rejected", "cancelled"],
  confirmed: [
    "reschedule_requested",
    "cancellation_requested",
    "cancelled",
    "no_show",
    "completed",
  ],
  reschedule_requested: ["confirmed", "cancelled"],
  cancellation_requested: ["confirmed", "cancelled"],
  rejected: [],
  cancelled: [],
  no_show: [],
  completed: [],
} as const satisfies Partial<Record<BookingStatus, readonly BookingStatus[]>>;

export type OrdinaryStatus = keyof typeof ORDINARY_TRANSITIONS;

function validationError(message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", message);
}

function timeToMinutes(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw validationError("startTime must use HH:MM");
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(
    value % 60,
  ).padStart(2, "0")}`;
}

export function validateOrdinaryAttendance(input: {
  participantCount: number;
  youngChildCount: number;
  accompanyingAdultCount: number;
}): number {
  const { participantCount, youngChildCount, accompanyingAdultCount } = input;
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw validationError("participantCount must be a positive integer");
  }
  if (
    !Number.isInteger(youngChildCount) ||
    youngChildCount < 0 ||
    youngChildCount > participantCount
  ) {
    throw validationError(
      "youngChildCount must be an integer no greater than participantCount",
    );
  }
  if (!Number.isInteger(accompanyingAdultCount) || accompanyingAdultCount < 0) {
    throw validationError(
      "accompanyingAdultCount must be a non-negative integer",
    );
  }
  if (youngChildCount > 0 && accompanyingAdultCount < 1) {
    throw validationError(
      "An accompanying adult is required when a five-to-eight-year-old attends",
    );
  }
  const attendanceCount = participantCount + accompanyingAdultCount;
  if (attendanceCount > 8) {
    throw validationError("physical attendance cannot exceed 8");
  }
  return attendanceCount;
}

export function buildOrdinaryInterval(input: {
  date: string;
  startTime: string;
  participantCount: number;
  accompanyingAdultCount: number;
  itemDurations: number[];
}): {
  date: string;
  startTime: string;
  endTime: string;
  attendanceCount: number;
  durationMinutes: number;
} {
  if (
    !input.itemDurations.length ||
    input.itemDurations.some((value) => !Number.isInteger(value) || value < 1)
  ) {
    throw validationError("at least one positive item duration is required");
  }
  const start = timeToMinutes(input.startTime);
  const durationMinutes = Math.max(...input.itemDurations);
  const end = start + durationMinutes;
  if (end > 24 * 60) {
    throw validationError("booking cannot end on the following day");
  }
  return {
    date: input.date,
    startTime: input.startTime,
    endTime: formatTime(end),
    attendanceCount: input.participantCount + input.accompanyingAdultCount,
    durationMinutes,
  };
}

export function assertOrdinaryTransition(
  from: string,
  to: BookingStatus,
): void {
  if (!Object.hasOwn(ORDINARY_TRANSITIONS, from)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "expectedStatus must be an ordinary workflow status",
    );
  }
  const ordinaryFrom = from as OrdinaryStatus;
  if (!ORDINARY_TRANSITIONS[ordinaryFrom].includes(to as never)) {
    throw new AppError(
      400,
      "INVALID_TRANSITION",
      `Cannot transition from "${from}" to "${to}"`,
    );
  }
}
