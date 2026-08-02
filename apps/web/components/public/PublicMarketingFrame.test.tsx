import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PublicMarketingFrame from "./PublicMarketingFrame";

vi.mock("@/components/public/PublicHeader", () => ({
  default: () => <header>public-header</header>,
}));

vi.mock("@/components/public/PublicFooter", () => ({
  default: () => <footer>public-footer</footer>,
}));

vi.mock("@/components/public/MobileStudioActions", () => ({
  default: () => <nav>mobile-studio-actions</nav>,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

const capabilities = {
  experience: false,
  party: false,
  product: false,
};

describe("PublicMarketingFrame", () => {
  it("provides the rose public frame without mounting cart behaviour", () => {
    const html = renderToStaticMarkup(
      <PublicMarketingFrame capabilities={capabilities}>
        <article>route-content</article>
      </PublicMarketingFrame>,
    );

    expect(html).toContain("public-site");
    expect(html).toContain("public-header");
    expect(html).toContain("public-footer");
    expect(html).toContain("mobile-studio-actions");
    expect(html).toContain("route-content");
    expect(html).not.toContain("cart-drawer");
  });
});
