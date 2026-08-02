import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("@/lib/site/data", () => ({
  loadHomePageData: vi.fn(async () => ({
    ok: true,
    data: {
      projects: [],
      parties: [],
      galleryImages: [],
      storeImage: null,
      heroImageUrl: "/verified-store.jpg",
      siteSettings: {
        requestCapabilities: {
          experience: true,
          party: true,
          product: false,
        },
      },
    },
  })),
}));

vi.mock("@/lib/catalogue/data", () => ({
  loadCataloguePageData: vi.fn(async () => ({ ok: true, data: [] })),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/components/sections/Hero", () => ({
  default: ({
    heroImageUrl,
    experienceEnabled,
  }: {
    heroImageUrl?: string;
    experienceEnabled?: boolean;
  }) => (
    <div
      data-testid="hero"
      data-image={heroImageUrl}
      data-booking={String(experienceEnabled)}
    />
  ),
}));

vi.mock("@/components/sections/PartyPackagesPreview", () => ({
  default: () => <div />,
}));
vi.mock("@/components/sections/GalleryHighlight", () => ({
  default: () => <div />,
}));
vi.mock("@/components/sections/WeChatCTA", () => ({
  default: () => <div />,
}));
vi.mock("@/components/sections/StudioConfidenceStrip", () => ({
  default: () => <div />,
}));
vi.mock("@/components/sections/StudioProcess", () => ({
  default: () => <div />,
}));
vi.mock("@/components/sections/EditorialProjects", () => ({
  default: () => <div />,
}));
vi.mock("@/components/sections/StudioVisitPreview", () => ({
  default: () => <div />,
}));

vi.mock("@/components/catalogue/CatalogueCategoryGrid", () => ({
  default: () => <div />,
}));
vi.mock("@/components/EmptyCatalogueState", () => ({
  EmptyCatalogueState: () => <div />,
}));
vi.mock("@/components/ServiceUnavailable", () => ({
  default: () => <div />,
}));

describe("HomePage", () => {
  it("passes the resolved real studio image and live booking gate to the hero", async () => {
    const html = renderToStaticMarkup(
      await HomePage({ params: Promise.resolve({ locale: "en" }) }),
    );

    expect(html).toContain('data-image="/verified-store.jpg"');
    expect(html).toContain('data-booking="true"');
  });
});
