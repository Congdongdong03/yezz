import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { loadSiteSettings } from "@/lib/site/data";
import Footer from "./Footer";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    children,
    className,
    href,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

function renderFooter(settings?: Awaited<ReturnType<typeof loadSiteSettings>>) {
  return renderToStaticMarkup(<Footer settings={settings} />);
}

describe("Footer", () => {
  it("uses the canonical public brand when settings are unavailable", () => {
    const html = renderFooter();

    expect(html).toContain(">YezYY<");
    expect(html).not.toContain("YEZZ");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/booking-terms"');
    expect(html).toContain('href="/cancellation-rescheduling"');
    expect(html).toContain('href="/party-terms"');
  });

  it("shows no invented ABN when none has been configured", () => {
    expect(renderFooter()).not.toContain("abn:");
  });

  it("displays a bare Xiaohongshu account ID without making it a link", async () => {
    const originalUseApi = process.env.NEXT_PUBLIC_USE_API;
    process.env.NEXT_PUBLIC_USE_API = "false";

    try {
      const html = renderFooter(await loadSiteSettings());

      expect(html).toContain(">95848743904<");
      expect(html).not.toContain('href="95848743904"');
    } finally {
      if (originalUseApi === undefined) {
        delete process.env.NEXT_PUBLIC_USE_API;
      } else {
        process.env.NEXT_PUBLIC_USE_API = originalUseApi;
      }
    }
  });

  it("keeps an absolute Xiaohongshu URL as an external link", async () => {
    const originalUseApi = process.env.NEXT_PUBLIC_USE_API;
    process.env.NEXT_PUBLIC_USE_API = "false";

    try {
      const settings = await loadSiteSettings();
      const xiaohongshu = "https://example.com/profile";
      const html = renderFooter({ ...settings, xiaohongshu });

      expect(html).toContain(`href="${xiaohongshu}"`);
    } finally {
      if (originalUseApi === undefined) {
        delete process.env.NEXT_PUBLIC_USE_API;
      } else {
        process.env.NEXT_PUBLIC_USE_API = originalUseApi;
      }
    }
  });
});
