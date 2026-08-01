/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { metadata } from "./page";

const api = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock("@/lib/admin/api", () => api);

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("admin forgot password page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    api.requestPasswordReset.mockReset().mockResolvedValue({ ok: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("submits a normalized email and always shows the generic recovery message", async () => {
    await act(async () => root.render(<ForgotPasswordForm />));
    const input = container.querySelector("input");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    await act(async () => {
      setter?.call(input, "  Owner@Example.COM  ");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(api.requestPasswordReset).toHaveBeenCalledWith(
      "owner@example.com",
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("如果该邮箱属于后台账户");
    expect(container.textContent).toContain("1 小时");
    expect(container.querySelector('a[href="/admin/login"]')).not.toBeNull();
  });

  it("declares noindex, nofollow, and no-referrer metadata", () => {
    expect(metadata).toEqual({
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    });
  });
});
