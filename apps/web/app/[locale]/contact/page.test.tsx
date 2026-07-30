import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ContactPage from "./page";

vi.mock("@/lib/site/data", () => ({
  loadSiteSettings: vi.fn(async () => ({ wechatId: undefined, wechatQrCodeUrl: undefined })),
}));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));

describe("ContactPage", () => {
  it("uses the marketing palette while retaining visit contact facts", async () => {
    const html = renderToStaticMarkup(await ContactPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(html).toContain("G082/235 Springvale Rd, Glen Waverley VIC 3150");
    expect(html).toContain("bg-[var(--public-canvas)]");
    expect(html).toContain("text-[var(--public-ink)]");
  });
});
