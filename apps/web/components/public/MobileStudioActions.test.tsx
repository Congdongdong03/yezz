import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MobileStudioActions from "./MobileStudioActions";

let locale = "en";

vi.mock("next-intl", () => ({
  useLocale: () => locale,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a"> & { children: ReactNode }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

describe("MobileStudioActions", () => {
  beforeEach(() => {
    locale = "en";
  });

  it("prioritises DIY booking and keeps call and directions available", () => {
    const html = renderToStaticMarkup(
      <MobileStudioActions
        capabilities={{ experience: true, party: true, product: false }}
      />,
    );

    expect(html).toContain('href="/book"');
    expect(html).toContain("Book DIY");
    expect(html).toContain('href="tel:0430787712"');
    expect(html).toContain("Call");
    expect(html).toContain("Directions");
    expect(html).not.toContain("cart");
  });

  it("uses parties as the primary request when DIY requests are closed", () => {
    const html = renderToStaticMarkup(
      <MobileStudioActions
        capabilities={{ experience: false, party: true, product: false }}
      />,
    );

    expect(html).toContain('href="/parties"');
    expect(html).toContain("Plan a party");
  });

  it("renders bilingual actions and no request link when requests are closed", () => {
    locale = "zh";
    const html = renderToStaticMarkup(
      <MobileStudioActions
        capabilities={{ experience: false, party: false, product: true }}
      />,
    );

    expect(html).not.toContain('href="/book"');
    expect(html).not.toContain('href="/parties"');
    expect(html).toContain("致电");
    expect(html).toContain("导航");
    expect(html).not.toContain("商品");
  });
});
