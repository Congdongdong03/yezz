/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SetupPasswordPage, { metadata } from "./page";

const TOKEN = "A".repeat(43);
const api = vi.hoisted(() => ({
  completePasswordSetup: vi.fn(),
}));

vi.mock("@/lib/admin/api", () => api);
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`token=${TOKEN}`),
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("admin password setup page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    api.completePasswordSetup.mockReset().mockResolvedValue({ ok: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderPage() {
    await act(async () => root.render(<SetupPasswordPage />));
  }

  it("sets the password from the query token without rendering or storing the token", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await renderPage();
    const inputs = container.querySelectorAll("input");
    const form = container.querySelector("form");

    expect(container.innerHTML).not.toContain(TOKEN);
    expect(inputs).toHaveLength(2);
    await act(async () => {
      for (const input of inputs) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, "NewOwnerPassword42!");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(api.completePasswordSetup).toHaveBeenCalledWith(
      TOKEN,
      "NewOwnerPassword42!",
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('a[href="/admin/login"]')).not.toBeNull();
    setItem.mockRestore();
  });

  it("does not submit mismatched or short passwords", async () => {
    await renderPage();
    const inputs = container.querySelectorAll("input");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(inputs[0], "too-short");
      inputs[0]?.dispatchEvent(new Event("input", { bubbles: true }));
      setter?.call(inputs[1], "different");
      inputs[1]?.dispatchEvent(new Event("input", { bubbles: true }));
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(api.completePasswordSetup).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/at least 12|至少 12/);
  });

  it("declares noindex, nofollow, and no-referrer metadata", () => {
    expect(metadata).toEqual({
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    });
  });
});
