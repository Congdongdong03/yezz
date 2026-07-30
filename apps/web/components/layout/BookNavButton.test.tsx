import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BookNavButton from "./BookNavButton";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) =>
    key === "browseProjects" ? "Browse projects" : "Book Now",
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a className={className} href={href}>{children}</a>
  ),
  usePathname: () => "/projects",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("BookNavButton", () => {
  it("becomes a catalogue link while experience and product requests are closed", () => {
    const html = renderToStaticMarkup(
      <BookNavButton className="cta" requestsEnabled={false} />,
    );

    expect(html).toContain('href="/projects"');
    expect(html).toContain("Browse projects");
    expect(html).not.toContain("Book Now");
  });
});
