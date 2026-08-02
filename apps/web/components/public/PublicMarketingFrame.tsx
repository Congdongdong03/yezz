"use client";

import type { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { SiteSettingsView } from "@/lib/site/data";
import PublicFooter from "./PublicFooter";
import PublicHeader, { type PublicMarketingCapabilities } from "./PublicHeader";
import MobileStudioActions from "./MobileStudioActions";

export default function PublicMarketingFrame({
  capabilities,
  children,
  settings,
}: {
  capabilities: PublicMarketingCapabilities;
  children: ReactNode;
  settings?: SiteSettingsView | null;
}) {
  return (
    <div className="public-site flex min-h-full flex-col">
      <PublicHeader capabilities={capabilities} />
      <main className="min-w-0 flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <PublicFooter settings={settings} />
      <MobileStudioActions capabilities={capabilities} />
    </div>
  );
}
