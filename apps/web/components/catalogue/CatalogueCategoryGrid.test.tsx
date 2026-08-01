import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CatalogueCategoryGrid from "./CatalogueCategoryGrid";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const entries = [
  ["air-dry-cream-piping", "Deco Cream DIY", "奶油胶DIY", 0],
  ["paint-clay", "Plaster Painting", "石膏彩绘", 1],
  ["beading", "Beading", "串珠", 2],
  ["melty-beads", "Melty Beads", "拼豆", 3],
].map(([slug, en, zh, order]) => ({
  _id: slug,
  slug: { current: `${slug}-entry` },
  category: { slug: { current: slug }, name: { en, zh }, order },
}));

describe("CatalogueCategoryGrid", () => {
  it("renders the four approved category links in customer order", () => {
    const html = renderToStaticMarkup(
      <CatalogueCategoryGrid entries={entries as never} locale="en" />,
    );

    expect(html).toContain('href="/en/projects#air-dry-cream-piping"');
    expect(html).toContain('href="/en/projects#paint-clay"');
    expect(html).toContain('href="/en/projects#beading"');
    expect(html).toContain('href="/en/projects#melty-beads"');
    expect(html.indexOf("Deco Cream DIY")).toBeLessThan(
      html.indexOf("Plaster Painting"),
    );
    expect(html.indexOf("Plaster Painting")).toBeLessThan(html.indexOf("Beading"));
  });
});
