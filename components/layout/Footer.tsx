"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="bg-warm-charcoal text-cream py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-xl font-serif font-bold mb-4">YEZZ</h3>
            <p className="text-sm opacity-80">Create your own masterpiece</p>
          </div>
          <div>
            <h4 className="font-medium mb-4">Links</h4>
            <div className="flex flex-col gap-2 text-sm opacity-80">
              <Link href="/projects" className="hover:text-white">Projects</Link>
              <Link href="/parties" className="hover:text-white">Parties</Link>
              <Link href="/gallery" className="hover:text-white">Gallery</Link>
              <Link href="/book" className="hover:text-white">Book Now</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-4">Contact</h4>
            <div className="text-sm opacity-80">
              <p>Email: hello@yezz.studio</p>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-8 text-center text-sm opacity-60">
          <p>© {new Date().getFullYear()} YEZZ. {t("rights")}</p>
        </div>
      </div>
    </footer>
  );
}
