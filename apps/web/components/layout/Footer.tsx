"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");

  return (
    <footer className="bg-warm-charcoal py-12 text-cream">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 font-serif text-xl font-bold">YEZZ</h3>
            <p className="text-sm opacity-80">{t("tagline")}</p>
          </div>
          <div>
            <h4 className="mb-4 font-medium">{t("links")}</h4>
            <div className="flex flex-col gap-2 text-sm opacity-80">
              <Link href="/projects" className="hover:text-white">
                {nav("projects")}
              </Link>
              <Link href="/parties" className="hover:text-white">
                {nav("parties")}
              </Link>
              <Link href="/gallery" className="hover:text-white">
                {nav("gallery")}
              </Link>
              <Link href="/book" className="hover:text-white">
                {nav("book")}
              </Link>
            </div>
          </div>
          <div>
            <h4 className="mb-4 font-medium">{t("contact")}</h4>
            <div className="text-sm opacity-80">
              <p>{t("email")}</p>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-8 text-center text-sm opacity-60">
          <p>
            © {new Date().getFullYear()} YEZZ. {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
