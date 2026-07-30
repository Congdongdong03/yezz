"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import CartIcon from "@/components/cart/CartIcon";
import { Link, usePathname } from "@/i18n/routing";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";
import type { SiteSettingsView } from "@/lib/site/data";
import RequestAction from "./RequestAction";

const navLinks = [
  { href: "/projects", key: "projects" },
  { href: "/parties", key: "parties" },
  { href: "/gallery", key: "gallery" },
  { href: "/contact", key: "contact" },
] as const;

export type PublicMarketingCapabilities = SiteSettingsView["requestCapabilities"];

export default function PublicHeader({
  capabilities,
}: {
  capabilities: PublicMarketingCapabilities;
}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--public-border)] bg-[var(--public-canvas)]/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-[var(--public-ink)]">
          {YEZYY_BUSINESS_PROFILE.storeName}
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-[var(--public-pink)] ${
                pathname.startsWith(link.href)
                  ? "text-[var(--public-pink)]"
                  : "text-[var(--public-ink)]"
              }`}
            >
              {t(link.key)}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={pathname}
            locale={locale === "zh" ? "en" : "zh"}
            className="text-sm text-[var(--public-muted)] transition-colors hover:text-[var(--public-ink)]"
          >
            {locale === "zh" ? "EN" : "中"}
          </Link>
          {capabilities.product ? <CartIcon /> : null}
          <RequestAction
            enabled={capabilities.experience}
            enabledHref="/book"
            disabledHref="/projects"
            enabledLabel={t("book")}
            disabledLabel={t("browseProjects")}
            className="rounded-full bg-[var(--public-pink)] px-6 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          />
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={t("mobileMenu")}
          className="text-[var(--public-ink)] md:hidden"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>
      {mobileOpen ? (
        <div className="border-t border-[var(--public-border)] bg-[var(--public-paper)] px-6 py-6 md:hidden">
          <div className="flex flex-col gap-5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="font-serif text-xl text-[var(--public-ink)] hover:text-[var(--public-pink)]"
              >
                {t(link.key)}
              </Link>
            ))}
            <RequestAction
              enabled={capabilities.experience}
              enabledHref="/book"
              disabledHref="/projects"
              enabledLabel={t("book")}
              disabledLabel={t("browseProjects")}
              className="mt-1 w-fit rounded-full bg-[var(--public-pink)] px-6 py-2 text-sm font-medium text-white"
            />
          </div>
        </div>
      ) : null}
    </header>
  );
}
