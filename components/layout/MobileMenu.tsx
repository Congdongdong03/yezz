"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
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
      </div>
    </div>
  );
}
