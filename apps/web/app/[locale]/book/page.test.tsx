import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BookPage from "./page";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/site/data", () => ({
  loadSiteSettings: vi.fn(async () => ({
    requestCapabilities: {
      experience: true,
      party: true,
      product: false,
    },
  })),
}));

vi.mock("@/lib/projects/data", () => ({
  loadProjectsPageData: vi.fn(async () => ({
    ok: true,
    data: {
      projects: [
        {
          _id: "bookable-experience",
          name: { en: "Beading", zh: "串珠" },
          category: {
            _id: "beading",
            name: { en: "Beading", zh: "串珠" },
            slug: { current: "beading" },
          },
          projectType: "experience",
          bookable: true,
          durationMinutes: 30,
          priceDisplay: "A$43",
          priceMin: 4300,
          priceMax: 4300,
        },
        {
          _id: "hidden-experience",
          name: { en: "Hidden", zh: "隐藏" },
          category: {
            _id: "hidden",
            name: { en: "Hidden", zh: "隐藏" },
            slug: { current: "hidden" },
          },
          projectType: "experience",
          bookable: false,
          durationMinutes: 60,
          priceDisplay: "A$50",
          priceMin: 5000,
          priceMax: 5000,
        },
        {
          _id: "product-only",
          name: { en: "Product", zh: "商品" },
          category: {
            _id: "product",
            name: { en: "Product", zh: "商品" },
            slug: { current: "product" },
          },
          projectType: "product",
          bookable: true,
          durationMinutes: 30,
          priceDisplay: "A$20",
          priceMin: 2000,
          priceMax: 2000,
        },
      ],
    },
  })),
}));

vi.mock("@/components/book/OrdinaryBookingForm", () => ({
  default: ({ initialProjectId }: { initialProjectId?: string }) => (
    <div data-initial-project={initialProjectId ?? "none"} />
  ),
}));

vi.mock("@/components/ServiceUnavailable", () => ({
  default: () => <div>service unavailable</div>,
}));

vi.mock("@/lib/site/metadata", () => ({
  buildPageMetadata: vi.fn((value) => value),
}));

describe("BookPage catalogue preselection", () => {
  async function renderPage(project?: string | string[]) {
    const page = await BookPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ project }),
    });
    return renderToStaticMarkup(page);
  }

  it("forwards a server-validated bookable experience project", async () => {
    expect(await renderPage("bookable-experience")).toContain(
      'data-initial-project="bookable-experience"',
    );
  });

  it.each([
    ["unknown project", "unknown"],
    ["unbookable experience", "hidden-experience"],
    ["product", "product-only"],
    ["array query", ["bookable-experience", "hidden-experience"]],
  ])("ignores a %s query value", async (_label, project) => {
    expect(await renderPage(project)).toContain('data-initial-project="none"');
  });
});
