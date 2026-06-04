"use client";

import { useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { X, ShoppingBag } from "lucide-react";
import BookNavButton from "./BookNavButton";
import { useCart } from "@/lib/cart/context";

const navLinks = [
  { href: "/", key: "home" },
  { href: "/projects", key: "projects" },
  { href: "/parties", key: "parties" },
  { href: "/gallery", key: "gallery" },
  { href: "/contact", key: "contact" },
] as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileMenu({ onClose }: { onClose: () => void }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { items } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-50 bg-cream"
      role="dialog"
      aria-modal="true"
      aria-label={t("mobileMenu")}
    >
      <div className="flex justify-end p-4">
        <button type="button" onClick={onClose} aria-label={t("closeMenu")}>
          <X size={28} />
        </button>
      </div>
      <div className="flex flex-col items-center gap-8 pt-12">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="text-2xl font-serif text-warm-charcoal hover:text-caramel"
          >
            {t(link.key)}
          </Link>
        ))}
        <Link
          href="/cart"
          onClick={onClose}
          className="relative flex items-center gap-2 text-2xl font-serif text-warm-charcoal hover:text-caramel"
        >
          <ShoppingBag size={24} />
          <span>{t("cart")}</span>
          {items.length > 0 && (
            <span className="absolute -right-4 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-caramel text-xs font-bold text-white">
              {items.length}
            </span>
          )}
        </Link>
        <BookNavButton
          className="rounded-full bg-caramel px-8 py-3 text-lg font-medium text-white"
        />
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
