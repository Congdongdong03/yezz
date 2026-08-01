import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CatalogueForm, { buildCataloguePayload } from "./CatalogueForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

const categories = [
  { id: "category-1", name: { en: "Beading", zh: "串珠" }, slug: "beading" },
];
const projects = [
  {
    id: "project-1",
    name: { en: "Bracelet", zh: "手链" },
    slug: "bracelet",
    category: { id: "category-1", name: { en: "Beading", zh: "串珠" } },
  },
];

describe("CatalogueForm", () => {
  it("requires bilingual public copy and keeps publication controls independent", () => {
    const html = renderToStaticMarkup(
      <CatalogueForm categories={categories as never} projects={projects as never} />,
    );

    expect(html).toContain("名称 (EN)");
    expect(html).toContain("名称 (ZH)");
    expect(html).toContain("公开介绍 (EN)");
    expect(html).toContain("公开介绍 (ZH)");
    expect(html).toContain('name="published"');
    expect(html).toContain('name="featured"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("公开价格来源项目");
    expect(html).toContain("Bracelet / 手链");
  });

  it("shows provenance fields for an inspiration image", () => {
    const html = renderToStaticMarkup(
      <CatalogueForm
        categories={categories as never}
        projects={projects as never}
        entry={{
          id: "entry-1",
          categoryId: "category-1",
          name: { en: "Beading", zh: "串珠" },
          slug: "beading",
          description: { en: "Make jewellery.", zh: "制作首饰。" },
          durationDisplay: { en: "30–45 minutes", zh: "30–45 分钟" },
          occasionTags: [],
          availabilityNote: { en: "Varies in store.", zh: "以门店为准。" },
          published: false,
          featured: true,
          sortOrder: 0,
          coverImageUrl: "https://images.example.com/beading.jpg",
          image: {
            kind: "inspiration",
            sourceUrl: "https://example.com/source",
            licenseUrl: "https://example.com/license",
            attribution: { en: "Photographer", zh: "摄影师" },
          },
          variants: [],
        } as never}
      />,
    );

    expect(html).toContain("图片来源网址");
    expect(html).toContain("图片许可网址");
    expect(html).toContain("图片署名 (EN)");
    expect(html).toContain("图片署名 (ZH)");
  });

  it("builds a catalogue-only payload without bookable", () => {
    const payload = buildCataloguePayload({
      categoryId: "category-1",
      name: { en: "Beading", zh: "串珠" },
      slug: "beading",
      description: { en: "Make jewellery.", zh: "制作首饰。" },
      durationDisplay: { en: "30–45 minutes", zh: "30–45 分钟" },
      occasionTags: [],
      availabilityNote: { en: "Varies.", zh: "以门店为准。" },
      published: false,
      featured: false,
      sortOrder: 0,
      coverImageUrl: "",
      imageKind: "placeholder",
      imageSourceUrl: "",
      imageLicenseUrl: "",
      imageAttribution: null,
      variants: [],
      bookable: true,
    } as never);

    expect(payload).not.toHaveProperty("bookable");
  });
});
