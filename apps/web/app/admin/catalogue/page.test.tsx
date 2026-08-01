import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogueList } from "./page";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("CatalogueList", () => {
  it("distinguishes published and hidden catalogue entries", () => {
    const html = renderToStaticMarkup(
      <CatalogueList
        items={[
          { id: "one", name: { en: "Beading", zh: "串珠" }, slug: "beading", published: true, featured: false, sortOrder: 1, category: { name: { en: "Beading", zh: "串珠" } }, variants: [] },
          { id: "two", name: { en: "Plaster", zh: "石膏彩绘" }, slug: "plaster", published: false, featured: true, sortOrder: 2, category: { name: { en: "Painting", zh: "彩绘" } }, variants: [] },
        ] as never}
      />,
    );

    expect(html).toContain("已发布");
    expect(html).toContain("已隐藏");
    expect(html).toContain("首页推荐");
    expect(html).toContain('href="/admin/catalogue/one/edit"');
  });
});
