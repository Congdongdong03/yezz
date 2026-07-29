import type { BookingStatus } from "@yezz/db";

export type LegacyBookingStatus =
  | "new"
  | "contacted"
  | "confirmed"
  | "cancelled";

const LEGACY_BOOKING_STATUSES: readonly LegacyBookingStatus[] = [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
];

const BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending_review",
  "confirmed",
  "waitlisted",
  "rejected",
  "time_proposed",
  "awaiting_in_store_payment",
  "confirmed_paid",
  "payment_expired",
  "reschedule_requested",
  "cancellation_requested",
  "cancelled",
  "refunded",
  "no_show",
  "completed",
];

export function isLegacyBookingStatus(
  status: string,
): status is LegacyBookingStatus {
  return LEGACY_BOOKING_STATUSES.includes(status as LegacyBookingStatus);
}

function isBookingStatus(status: string): status is BookingStatus {
  return BOOKING_STATUSES.includes(status as BookingStatus);
}

export function bookingStatusFromLegacyStatus(
  status: LegacyBookingStatus,
): BookingStatus {
  switch (status) {
    case "new":
    case "contacted":
      return "pending_review";
    case "confirmed":
      return "confirmed";
    case "cancelled":
      return "cancelled";
  }
}

export function legacyStatusFromBookingStatus(
  status: BookingStatus,
): LegacyBookingStatus {
  switch (status) {
    case "pending_review":
      return "new";
    case "confirmed":
      return "confirmed";
    case "cancelled":
      return "cancelled";
    default:
      throw new Error(
        `Booking status "${status}" is not supported by the legacy booking API`,
      );
  }
}

export function legacyStatusFromStoredValue(
  status: string,
): LegacyBookingStatus {
  if (isLegacyBookingStatus(status)) return status;
  if (isBookingStatus(status)) return legacyStatusFromBookingStatus(status);
  throw new Error(`Unknown booking status "${status}"`);
}
