import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GalleryPage from "./page";

vi.mock("@/lib/site/data", () => ({ loadGalleryPageData: vi.fn(async () => ({ ok: true, data: [] })) }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));

describe("GalleryPage", () => {
  it("uses the marketing palette for its honest empty catalogue state", async () => {
    const html = renderToStaticMarkup(await GalleryPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(html).toContain("bg-[var(--public-canvas)]");
    expect(html).toContain("text-[var(--public-ink)]");
  });
});
