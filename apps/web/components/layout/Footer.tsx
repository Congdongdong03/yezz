"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ExternalLink } from "lucide-react";
import type { SiteSettingsView } from "@/lib/site/data";

function XiaohongshuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.2 7.1c.28 0 .5.22.5.5v6.8c0 .28-.22.5-.5.5h-8.4c-.28 0-.5-.22-.5-.5v-6.8c0-.28.22-.5.5-.5h8.4zm-1.1 1.6h-6.2v5.6h6.2V10.7zm-5.1 4.2h1.4v-1.4h-1.4v1.4zm2.2 0h1.4v-1.4h-1.4v1.4zm2.2 0h1.4v-1.4h-1.4v1.4z" />
    </svg>
  );
}

export default function Footer({ settings }: { settings?: SiteSettingsView | null }) {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");

  return (
    <footer className="bg-warm-charcoal py-12 text-cream">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 font-serif text-xl font-bold">
              {settings?.storeName ?? "YEZZ"}
            </h3>
            <p className="text-sm opacity-80">{t("tagline")}</p>
            {(settings?.instagram || settings?.xiaohongshu) && (
              <div className="mt-4 flex gap-3">
                {settings.instagram && (
                  <a
                    href={settings.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full p-2 opacity-80 transition-opacity hover:opacity-100"
                    aria-label="Instagram"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                )}
                {settings.xiaohongshu && (
                  <a
                    href={settings.xiaohongshu}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full p-2 opacity-80 transition-opacity hover:opacity-100"
                    aria-label={t("xiaohongshu")}
                  >
                    <XiaohongshuIcon className="h-5 w-5" />
                  </a>
                )}
              </div>
            )}
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
              <Link href="/contact" className="hover:text-white">
                {nav("contact")}
              </Link>
            </div>
          </div>
          <div>
            <h4 className="mb-4 font-medium">{t("contact")}</h4>
            <div className="space-y-1 text-sm opacity-80">
              {settings?.email ? <p>{settings.email}</p> : <p>{t("email")}</p>}
              {settings?.phone && <p>{settings.phone}</p>}
              {settings?.address && <p>{settings.address}</p>}
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
