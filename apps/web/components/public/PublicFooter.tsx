"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { formatPhoneHref, YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";
import type { SiteSettingsView } from "@/lib/site/data";

export default function PublicFooter({
  settings,
}: {
  settings?: SiteSettingsView | null;
}) {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const instagram = settings?.instagram?.startsWith("https://")
    ? settings.instagram
    : undefined;

  return (
    <footer className="bg-[var(--public-footer)] py-12 text-[var(--public-ink)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
        <div>
          <h2 className="font-serif text-xl font-bold">
            {YEZYY_BUSINESS_PROFILE.storeName}
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--public-muted)]">
            {t("tagline")}
          </p>
          <p className="mt-4 text-sm text-[var(--public-muted)]">
            小红书 · {YEZYY_BUSINESS_PROFILE.xiaohongshu}
          </p>
          {instagram ? (
            <a
              className="mt-2 inline-block text-sm text-[var(--public-muted)] hover:text-[var(--public-ink)]"
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
          ) : null}
        </div>
        <div>
          <h2 className="font-medium">{t("links")}</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--public-muted)]">
            <Link href="/projects">{nav("projects")}</Link>
            <Link href="/parties">{nav("parties")}</Link>
            <Link href="/gallery">{nav("gallery")}</Link>
            <Link href="/contact">{nav("contact")}</Link>
          </div>
        </div>
        <div>
          <h2 className="font-medium">{t("policies")}</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--public-muted)]">
            <Link href="/privacy">{t("privacy")}</Link>
            <Link href="/booking-terms">{t("bookingTerms")}</Link>
            <Link href="/cancellation-rescheduling">{t("cancellation")}</Link>
            <Link href="/party-terms">{t("partyTerms")}</Link>
          </div>
          <h2 className="mt-6 font-medium">{t("contact")}</h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--public-muted)]">
            <a
              className="block hover:text-[var(--public-ink)]"
              href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
            >
              {YEZYY_BUSINESS_PROFILE.email}
            </a>
            <a
              className="block hover:text-[var(--public-ink)]"
              href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
            >
              {YEZYY_BUSINESS_PROFILE.phone}
            </a>
            <p>{YEZYY_BUSINESS_PROFILE.address}</p>
            {YEZYY_BUSINESS_PROFILE.abn ? (
              <p>
                {t("abn")}: {YEZYY_BUSINESS_PROFILE.abn}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-7xl border-t border-[var(--public-ink)]/10 px-4 pt-6 text-center text-sm text-[var(--public-muted)] sm:px-6">
        © {new Date().getFullYear()} {YEZYY_BUSINESS_PROFILE.storeName}.{" "}
        {t("rights")}
      </p>
    </footer>
  );
}
