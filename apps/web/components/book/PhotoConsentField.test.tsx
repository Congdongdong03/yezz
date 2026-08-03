import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PhotoConsentField from "./PhotoConsentField";

describe("PhotoConsentField", () => {
  it("defaults to a clear refusal without requiring a signature", () => {
    const html = renderToStaticMarkup(
      <PhotoConsentField
        decision="declined"
        locale="en"
        onDecisionChange={vi.fn()}
        onSignerNameChange={vi.fn()}
        signerName=""
      />,
    );
    expect(html).toContain("Choosing no will not affect your request");
    expect(html).toContain("No permission");
    expect(html).not.toContain("photoConsentSignerName");
  });

  it("limits a guardian grant to their own child and records the signer", () => {
    const html = renderToStaticMarkup(
      <PhotoConsentField
        decision="guardian_for_minor"
        locale="en"
        onDecisionChange={vi.fn()}
        onSignerNameChange={vi.fn()}
        signerName="Parent Name"
      />,
    );
    expect(html).toContain("does not cover other children");
    expect(html).toContain("photoConsentSignerName");
    expect(html).toContain("Parent Name");
  });
});
