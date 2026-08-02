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

  it("guides visitors to projects instead of a closed booking entry", () => {
    const html = renderToStaticMarkup(
      <Hero heroImageUrl="/hero.jpg" experienceEnabled={false} />,
    );

    expect(html).toContain('href="/projects"');
    expect(html).not.toContain('href="/book"');
  });

  it("keeps hero copy and the CTA visible in server-rendered markup", () => {
    const html = renderToStaticMarkup(
      <Hero heroImageUrl="/hero.jpg" experienceEnabled={false} />,
    );

    expect(html).toContain(">eyebrow</p>");
    expect(html).toContain(">title</h1>");
    expect(html).toContain(">subtitle</p>");
    expect(html).toContain(">browseProjects</a>");
    expect(html).not.toContain("opacity:0");
  });

  it("keeps an honest designed hero when no real studio image is available", () => {
    const html = renderToStaticMarkup(
      <Hero heroImageUrl={undefined} experienceEnabled />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain('href="/book"');
    expect(html).toContain("public-hero");
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
