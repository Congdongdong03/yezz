import { describe, expect, it } from "vitest";
import {
  CURRENT_PHOTO_CONSENT_VERSION,
  normalizePhotoConsent,
} from "./photo-consent.js";

describe("normalizePhotoConsent", () => {
  it("records an omitted choice as an explicit current-version refusal", () => {
    expect(normalizePhotoConsent(undefined)).toEqual({
      decision: "declined",
      signerName: null,
      version: CURRENT_PHOTO_CONSENT_VERSION,
    });
  });

  it("trims and keeps the signer for a guardian grant", () => {
    expect(
      normalizePhotoConsent({
        decision: "guardian_for_minor",
        signerName: "  Parent Name  ",
        version: CURRENT_PHOTO_CONSENT_VERSION,
      }),
    ).toEqual({
      decision: "guardian_for_minor",
      signerName: "Parent Name",
      version: "2026-08-03",
    });
  });

  it("rejects a grant without a signer", () => {
    expect(() =>
      normalizePhotoConsent({
        decision: "adult_only",
        version: CURRENT_PHOTO_CONSENT_VERSION,
      }),
    ).toThrowError(/signerName is required/);
  });

  it("rejects a stale consent statement version", () => {
    expect(() =>
      normalizePhotoConsent({
        decision: "declined",
        version: "2026-07-30" as never,
      }),
    ).toThrowError(/current photo consent statement/);
  });
});
