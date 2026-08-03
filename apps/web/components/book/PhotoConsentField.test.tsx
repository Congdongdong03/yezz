/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PhotoConsentField from "./PhotoConsentField";

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("PhotoConsentField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("starts declined and hides the adult and child permission choices", async () => {
    await act(async () => {
      root.render(
        <PhotoConsentField
          decision="declined"
          locale="en"
          onDecisionChange={vi.fn()}
          onSignerNameChange={vi.fn()}
          signerName=""
        />,
      );
    });

    const disclosure = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]',
    );
    expect(disclosure?.textContent).toContain("No photo or video permission");
    expect(container.textContent).not.toContain("Adult only");
    expect(container.textContent).not.toContain("My child");
    expect(container.querySelector('[name="photoConsentSignerName"]')).toBeNull();
  });

  it("expands only when the customer chooses to consider permission", async () => {
    await act(async () => {
      root.render(
        <PhotoConsentField
          decision="declined"
          locale="en"
          onDecisionChange={vi.fn()}
          onSignerNameChange={vi.fn()}
          signerName=""
        />,
      );
    });

    const disclosure = container.querySelector<HTMLButtonElement>("button");
    await act(async () => disclosure?.click());

    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Adult only");
    expect(container.textContent).toContain("does not cover other children");
  });

  it("resets the decision and signer when permission is collapsed", async () => {
    const onDecisionChange = vi.fn();
    const onSignerNameChange = vi.fn();
    await act(async () => {
      root.render(
        <PhotoConsentField
          decision="guardian_for_minor"
          locale="en"
          onDecisionChange={onDecisionChange}
          onSignerNameChange={onSignerNameChange}
          signerName="Parent Name"
        />,
      );
    });

    const disclosure = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded="true"]',
    );
    expect(container.querySelector('[name="photoConsentSignerName"]')).not.toBeNull();
    await act(async () => disclosure?.click());

    expect(onDecisionChange).toHaveBeenLastCalledWith("declined");
    expect(onSignerNameChange).toHaveBeenLastCalledWith("");
  });
});
