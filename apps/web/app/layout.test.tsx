/** @vitest-environment jsdom */

import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/admin/setup-password",
}));

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "inter-variable" }),
  Noto_Serif_SC: () => ({ variable: "noto-serif-variable" }),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { defaultLocale: "zh" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
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
    navigation.pathname = "/admin/setup-password";
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

  it("renders no analytics script or customer management token transmission", async () => {
    const token = "M".repeat(43);
    navigation.pathname = `/en/manage-booking/${token}`;
    window.history.replaceState({}, "", navigation.pathname);

    const { default: RootLayout } = await import("./layout");
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Manage booking</main>
      </RootLayout>,
    );

    expect(markup).not.toContain("googletagmanager");
    expect(markup).not.toContain("G-SECURITY-REGRESSION");
    expect(markup).not.toContain("gtag(");
    expect(markup).not.toContain(token);
    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();
  });

  it("publishes the configured Search Console verification token", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "google-proof-123");
    vi.resetModules();

    const { metadata } = await import("./layout");
    expect(metadata.verification).toEqual({ google: "google-proof-123" });
  });
});
