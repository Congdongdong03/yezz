import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage from "./page";

const state = vi.hoisted(() => ({
  experienceEnabled: true,
}));

vi.mock("@/lib/catalogue/data", () => ({
  loadCatalogueEntry: vi.fn(async () => ({
    ok: true,
    data: {
      _id: "catalogue-entry",
      slug: { current: "melty-beads" },
    },
  })),
}));

vi.mock("@/lib/site/data", () => ({
  loadSiteSettings: vi.fn(async () => ({
    requestCapabilities: {
      experience: state.experienceEnabled,
      party: true,
      product: false,
    },
  })),
}));

vi.mock("@/components/catalogue/CatalogueDetail", () => ({
  default: ({ requestEnabled }: { requestEnabled: boolean }) => (
    <div data-request-enabled={String(requestEnabled)} />
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    state.experienceEnabled = true;
  });

  async function renderPage() {
    const page = await ProjectDetailPage({
      params: Promise.resolve({ locale: "en", slug: "melty-beads" }),
    });
    return renderToStaticMarkup(page);
  }

  it("opens catalogue booking actions when the live experience gate is enabled", async () => {
    expect(await renderPage()).toContain('data-request-enabled="true"');
  });

  it("keeps catalogue booking actions closed when the live experience gate is disabled", async () => {
    state.experienceEnabled = false;

    expect(await renderPage()).toContain('data-request-enabled="false"');
  });
});
