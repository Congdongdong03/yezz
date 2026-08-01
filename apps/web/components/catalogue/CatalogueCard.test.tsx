import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CatalogueCard from "./CatalogueCard";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const inspirationEntry = {
  _id: "plaster",
  slug: { current: "plaster-painting" },
  name: { en: "Plaster Painting", zh: "石膏彩绘" },
  description: { en: "Paint it.", zh: "画一画。" },
  durationDisplay: { en: "About 1 hour", zh: "约 1 小时" },
  occasionTags: [{ en: "Family activity", zh: "亲子活动" }],
  availabilityNote: { en: "Styles vary.", zh: "款式以门店为准。" },
  imageUrl: "https://images.example.com/plaster.jpg",
  image: {
    kind: "inspiration" as const,
    sourceUrl: "https://unsplash.com/photos/plaster",
    licenseUrl: "https://unsplash.com/license",
    attribution: { en: "Unsplash", zh: "Unsplash" },
  },
  priceDisplay: "A$19.80–A$54.00",
};

describe("CatalogueCard", () => {
  it("discloses licensed inspiration images with a source link", () => {
    const html = renderToStaticMarkup(
      <CatalogueCard entry={inspirationEntry as never} locale="en" />,
    );

    expect(html).toContain("DIY inspiration");
    expect(html).toContain('href="https://unsplash.com/photos/plaster"');
    expect(html).toContain("A$19.80–A$54.00");
  });

  it("does not make an inspiration claim for a YezYY image", () => {
    const html = renderToStaticMarkup(
      <CatalogueCard
        entry={{
          ...inspirationEntry,
          image: {
            kind: "yezyy",
            sourceUrl: null,
            licenseUrl: null,
            attribution: null,
          },
        } as never}
        locale="en"
      />,
    );

    expect(html).not.toContain("DIY inspiration");
  });
});
