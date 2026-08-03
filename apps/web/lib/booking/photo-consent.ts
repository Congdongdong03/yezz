export const CURRENT_PHOTO_CONSENT_VERSION = "2026-08-03" as const;

export type PhotoConsentDecision =
  | "declined"
  | "adult_only"
  | "guardian_for_minor";
