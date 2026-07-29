"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_ID } from "@/lib/analytics/gtag";

export default function GoogleAnalytics() {
  const pathname = usePathname();
  if (!GA_ID || pathname === "/admin/setup-password") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { page_path: window.location.pathname });
        `}
      </Script>
    </>
  );
}
