/**
 * A booking occupies the studio until its cancellation or reschedule has been
 * resolved. Keep every availability, calendar, and admin conflict query on
 * this one policy.
 */
export function occupiesStudioSchedule(
  requestKind: string,
  status: string,
): boolean {
  return (
    (requestKind === "experience" &&
      [
        "confirmed",
        "cancellation_requested",
        "reschedule_requested",
      ].includes(status)) ||
    (requestKind === "party" &&
      [
        "awaiting_in_store_payment",
        "confirmed_paid",
        "confirmed",
        "cancellation_requested",
        "reschedule_requested",
      ].includes(status))
  );
}

export const OCCUPYING_EXPERIENCE_STATUSES = [
  "confirmed",
  "cancellation_requested",
  "reschedule_requested",
] as const;

export const OCCUPYING_PARTY_STATUSES = [
  "awaiting_in_store_payment",
  "confirmed_paid",
  "confirmed",
  "cancellation_requested",
  "reschedule_requested",
] as const;
