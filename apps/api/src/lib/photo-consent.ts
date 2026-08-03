import { AppError } from "./errors.js";

export const CURRENT_PHOTO_CONSENT_VERSION = "2026-08-03" as const;

export type PhotoConsentDecision =
  | "declined"
  | "adult_only"
  | "guardian_for_minor";

export type PhotoConsentInput = {
  decision: PhotoConsentDecision;
  signerName?: string;
  version: typeof CURRENT_PHOTO_CONSENT_VERSION;
};

export type NormalizedPhotoConsent = {
  decision: PhotoConsentDecision;
  signerName: string | null;
  version: typeof CURRENT_PHOTO_CONSENT_VERSION;
};

function validationError(message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", message);
}

export function normalizePhotoConsent(
  input?: PhotoConsentInput,
): NormalizedPhotoConsent {
  if (!input) {
    return {
      decision: "declined",
      signerName: null,
      version: CURRENT_PHOTO_CONSENT_VERSION,
    };
  }
  if (input.version !== CURRENT_PHOTO_CONSENT_VERSION) {
    throw validationError("The current photo consent statement must be used");
  }
  if (
    !["declined", "adult_only", "guardian_for_minor"].includes(input.decision)
  ) {
    throw validationError("photo consent decision is invalid");
  }
  if (input.decision === "declined") {
    return {
      decision: input.decision,
      signerName: null,
      version: input.version,
    };
  }
  const signerName = input.signerName?.trim() ?? "";
  if (signerName.length < 2) {
    throw validationError(
      "photo consent signerName is required for permission",
    );
  }
  return {
    decision: input.decision,
    signerName,
    version: input.version,
  };
}
