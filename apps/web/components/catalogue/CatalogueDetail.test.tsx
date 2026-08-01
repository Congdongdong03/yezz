import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CatalogueDetail from "./CatalogueDetail";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const entry = {
  _id: "melty",
  slug: { current: "melty-beads" },
  name: { en: "Melty Beads", zh: "拼豆" },
  description: { en: "Make a bead design.", zh: "制作拼豆图案。" },
  durationDisplay: { en: "1 hour", zh: "1 小时" },
  occasionTags: [],
  availabilityNote: { en: "Colours vary.", zh: "颜色以门店为准。" },
  image: { kind: "placeholder", sourceUrl: null, licenseUrl: null, attribution: null },
  priceDisplay: "A$49.50",
  variants: [
    {
      projectId: "melty-project",
      slug: "melty-bead-craft",
      name: { en: "Melty Bead Craft", zh: "拼豆手作" },
      priceDisplay: "A$49.50",
      bookable: true,
      extraTimeMinutes: 30,
      extraTimePriceCents: 1650,
    },
  ],
};

describe("CatalogueDetail", () => {
  it("shows the fact rail, variant guidance, and closed-request contact fallback", () => {
    const html = renderToStaticMarkup(
      <CatalogueDetail entry={entry as never} locale="en" requestEnabled={false} />,
    );

    expect(html).toContain('data-testid="catalogue-fact-rail"');
    expect(html).toContain("A$49.50");
    expect(html).toContain("A$16.50 / 30 min");
    expect(html).toContain('data-testid="request-contact-fallback"');
    expect(html).not.toContain("Book Now");
    expect(html).not.toContain("Add to Cart");
  });

  it("offers a specific bookable variant when ordinary requests are open", () => {
    const html = renderToStaticMarkup(
      <CatalogueDetail entry={entry as never} locale="en" requestEnabled />,
    );

    expect(html).toContain('href="/en/book?project=melty-project"');
    expect(html).toContain('aria-label="Book Melty Bead Craft"');
    expect(html).toContain("Book this option");
    expect(html).toContain("Manual confirmation · Pay in store");
    expect(html).not.toContain('data-testid="request-contact-fallback"');
  });

  it("keeps an unbookable variant useful without exposing a booking link", () => {
    const unbookable = {
      ...entry,
      variants: [{ ...entry.variants[0], bookable: false }],
    };
    const html = renderToStaticMarkup(
      <CatalogueDetail
        entry={unbookable as never}
        locale="zh"
        requestEnabled
      />,
    );

    expect(html).toContain("到店咨询");
    expect(html).not.toContain("/zh/book?project=");
    expect(html).not.toContain('data-testid="request-contact-fallback"');
  });
});
