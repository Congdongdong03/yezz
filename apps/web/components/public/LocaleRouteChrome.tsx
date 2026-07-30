"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import CartDrawer from "@/components/cart/CartDrawer";
import CartToast from "@/components/cart/CartToast";
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { CartProvider } from "@/lib/cart/context";
import type { SiteSettingsView } from "@/lib/site/data";
import PublicMarketingFrame from "./PublicMarketingFrame";
import type { PublicMarketingCapabilities } from "./PublicHeader";

function isMarketingPath(pathname: string): boolean {
  return /^\/(?:en|zh)(?:\/(?:gallery|contact))?\/?$/.test(pathname);
}

export default function LocaleRouteChrome({
  capabilities,
  children,
  settings,
}: {
  capabilities: PublicMarketingCapabilities;
  children: ReactNode;
  settings?: SiteSettingsView | null;
}) {
  const pathname = usePathname();

  if (isMarketingPath(pathname)) {
    return (
      <PublicMarketingFrame capabilities={capabilities} settings={settings}>
        {children}
      </PublicMarketingFrame>
    );
  }

  return (
    <CartProvider>
      <div className="public-app flex min-h-screen flex-col">
        <Navbar capabilities={capabilities} />
        <main className="flex-1"><ErrorBoundary>{children}</ErrorBoundary></main>
        <Footer settings={settings} />
        <CartDrawer />
        <CartToast />
      </div>
    </CartProvider>
  );
}
