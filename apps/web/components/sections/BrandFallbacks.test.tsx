import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Hero from "./Hero";
import StoreVibes from "./StoreVibes";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("public image brand fallbacks", () => {
  it("uses the canonical brand in the hero image description", () => {
    const html = renderToStaticMarkup(<Hero heroImageUrl="/hero.jpg" />);

    expect(html).toContain('alt="YezYY Studio"');
  });

  it("uses the canonical brand in the store image description", () => {
    const html = renderToStaticMarkup(
      <StoreVibes storeImage={{ _id: "store", imageUrl: "/store.jpg" }} />,
    );

    expect(html).toContain('alt="YezYY Studio"');
  });

  it("uses the canonical brand in the missing-store-image fallback", () => {
    const html = renderToStaticMarkup(<StoreVibes storeImage={null} />);

    expect(html).toContain(">YezYY Studio<");
  });
});
