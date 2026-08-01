import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchCatalogueMock } = vi.hoisted(() => ({
  fetchCatalogueMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  fetchCatalogue: fetchCatalogueMock,
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "zh"] },
}));

vi.mock("@/lib/site/url", () => ({
  getSiteUrl: () => "https://yezyy.com",
}));

import sitemap from "./sitemap";

describe("public sitemap", () => {
  beforeEach(() => {
    fetchCatalogueMock.mockReset();
    vi.stubEnv("NEXT_PUBLIC_USE_API", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("indexes published catalogue slugs instead of operational booking slugs", async () => {
    fetchCatalogueMock.mockResolvedValue([
      { slug: "plaster-painting" },
      { slug: "beading" },
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://yezyy.com/en/projects/plaster-painting");
    expect(urls).toContain("https://yezyy.com/zh/projects/plaster-painting");
    expect(urls).toContain("https://yezyy.com/en/projects/beading");
    expect(fetchCatalogueMock).toHaveBeenCalledOnce();
  });
});
