/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminShell from "./AdminShell";

const navigation = vi.hoisted(() => ({
  pathname: "/admin/forgot-password",
  replace: vi.fn(),
}));
const api = vi.hoisted(() => ({
  getMe: vi.fn(),
  getUnreadCounts: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/lib/admin/api", () => api);

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("AdminShell public authentication routes", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    api.getMe.mockReset().mockRejectedValue(new Error("not signed in"));
    api.getUnreadCounts.mockReset();
    api.logout.mockReset();
    navigation.replace.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("renders password recovery without requiring an existing session", async () => {
    await act(async () => {
      root.render(<AdminShell>恢复密码</AdminShell>);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("恢复密码");
    expect(api.getMe).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
