"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Menu, X } from "lucide-react";
import MobileMenu from "./MobileMenu";
import CartIcon from "@/components/cart/CartIcon";

const navLinks = [
  { href: "/", key: "home" },
  { href: "/projects", key: "projects" },
  { href: "/parties", key: "parties" },
  { href: "/gallery", key: "gallery" },
  { href: "/contact", key: "contact" },
];

export default function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-2xl font-bold text-warm-charcoal">
          YEZZ
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href as "/" | "/projects" | "/parties" | "/gallery" | "/contact"}
              className={`text-sm font-medium transition-colors hover:text-caramel ${
                link.href === "/"
                  ? pathname === "/"
                    ? "text-caramel"
                    : "text-warm-charcoal"
                  : pathname.startsWith(link.href)
                    ? "text-caramel"
                    : "text-warm-charcoal"
              }`}
            >
              {t(link.key as "home" | "projects" | "parties" | "gallery" | "contact")}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={pathname}
            locale={locale === "zh" ? "en" : "zh"}
            className="text-sm text-warm-grey hover:text-warm-charcoal"
          >
            {locale === "zh" ? "EN" : "中"}
          </Link>
          <CartIcon />
          <Link
            href="/book"
            className="rounded-full bg-caramel px-6 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {t("book")}
          </Link>
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <CartIcon />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </header>
  );
}
