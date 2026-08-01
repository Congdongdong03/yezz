import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CatalogueSection from "./CatalogueSection";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("CatalogueSection", () => {
  it("renders grouped Plaster Painting as one curated card", () => {
    const html = renderToStaticMarkup(
      <CatalogueSection
        locale="en"
        category={{
          slug: { current: "paint-clay" },
          name: { en: "Plaster Painting", zh: "石膏彩绘" },
        } as never}
        entries={[
          {
            _id: "plaster",
            slug: { current: "plaster-painting" },
            name: { en: "Plaster Painting", zh: "石膏彩绘" },
            durationDisplay: { en: "About 1 hour", zh: "约 1 小时" },
            occasionTags: [],
            availabilityNote: { en: "Styles vary.", zh: "款式以门店为准。" },
            image: { kind: "placeholder", sourceUrl: null, licenseUrl: null, attribution: null },
            priceDisplay: "A$19.80–A$54.00",
          },
        ] as never}
      />,
    );

    expect(html.match(/href="\/en\/projects\/plaster-painting"/g)).toHaveLength(1);
    expect(html).toContain("Plaster Painting");
  });
});
