"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { X } from "lucide-react";

const navLinks = [
  { href: "/", key: "home" },
  { href: "/projects", key: "projects" },
  { href: "/parties", key: "parties" },
  { href: "/gallery", key: "gallery" },
  { href: "/book", key: "book" },
  { href: "/contact", key: "contact" },
];

export default function MobileMenu({ onClose }: { onClose: () => void }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 z-50 bg-cream">
      <div className="flex justify-end p-4">
        <button onClick={onClose} aria-label="Close menu">
          <X size={28} />
        </button>
      </div>
      <div className="flex flex-col items-center gap-8 pt-12">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href as "/" | "/projects" | "/parties" | "/gallery" | "/book" | "/contact"}
            onClick={onClose}
            className="text-2xl font-serif text-warm-charcoal hover:text-caramel"
          >
            {t(link.key as "home" | "projects" | "parties" | "gallery" | "book" | "contact")}
          </Link>
        ))}
        <Link
          href={pathname}
          locale={locale === "zh" ? "en" : "zh"}
          onClick={onClose}
          className="mt-4 text-lg font-medium text-warm-grey hover:text-caramel"
        >
          {locale === "zh" ? "EN" : "中"}
        </Link>
      </div>
    </div>
  );
}
