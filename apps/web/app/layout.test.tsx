/** @vitest-environment jsdom */

import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "inter-variable" }),
  Noto_Serif_SC: () => ({ variable: "noto-serif-variable" }),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { defaultLocale: "zh" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/setup-password",
}));

vi.mock("next/script", () => ({
  default: ({
    children,
    ...props
  }: ComponentProps<"script"> & { strategy?: string }) => (
    <script {...props}>{children}</script>
  ),
}));

describe("root layout on the password setup route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-SECURITY-REGRESSION");
    window.history.replaceState(
      {},
      "",
      `/admin/setup-password?token=${"S".repeat(43)}`,
    );
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "gtag");
  });

  it("renders no analytics script, configuration event, or setup token transmission", async () => {
    const { default: RootLayout } = await import("./layout");
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Secure setup</main>
      </RootLayout>,
    );

    expect(markup).not.toContain("googletagmanager");
    expect(markup).not.toContain("G-SECURITY-REGRESSION");
    expect(markup).not.toContain("gtag(");
    expect(markup).not.toContain("token=");
    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();
  });
});
