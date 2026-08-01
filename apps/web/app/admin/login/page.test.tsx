import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AdminLoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/admin/api", () => ({
  getMe: vi.fn(() => new Promise(() => {})),
  login: vi.fn(),
}));

describe("admin login page", () => {
  it("offers password recovery to administrators who cannot sign in", () => {
    const html = renderToStaticMarkup(<AdminLoginPage />);

    expect(html).toContain('href="/admin/forgot-password"');
    expect(html).toContain("忘记密码");
  });
});
