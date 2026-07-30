import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LocaleRouteChrome from "./LocaleRouteChrome";

let pathname = "/en";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@/components/public/PublicMarketingFrame", () => ({
  default: ({ children }: { children: ReactNode }) => <div>marketing-frame{children}</div>,
}));

vi.mock("@/components/layout/Navbar", () => ({ default: () => <header>legacy-navbar</header> }));
vi.mock("@/components/layout/Footer", () => ({ default: () => <footer>legacy-footer</footer> }));
vi.mock("@/components/cart/CartDrawer", () => ({ default: () => <aside>cart-drawer</aside> }));
vi.mock("@/components/cart/CartToast", () => ({ default: () => <aside>cart-toast</aside> }));
vi.mock("@/components/ErrorBoundary", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/cart/context", () => ({ CartProvider: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const capabilities = { experience: false, party: false, product: false };

describe("LocaleRouteChrome", () => {
  it("uses the marketing frame only for home, gallery, and contact", () => {
    for (const route of ["/en", "/zh/gallery", "/en/contact"]) {
      pathname = route;
      const html = renderToStaticMarkup(
        <LocaleRouteChrome capabilities={capabilities}><article>content</article></LocaleRouteChrome>,
      );
      expect(html).toContain("marketing-frame");
      expect(html).not.toContain("legacy-navbar");
    }
  });

  it("keeps the established application chrome for workflow routes", () => {
    pathname = "/en/book";
    const html = renderToStaticMarkup(
      <LocaleRouteChrome capabilities={capabilities}><article>content</article></LocaleRouteChrome>,
    );
    expect(html).toContain("legacy-navbar");
    expect(html).toContain("legacy-footer");
    expect(html).not.toContain("marketing-frame");
    expect(html).toContain("public-app");
  });
});
