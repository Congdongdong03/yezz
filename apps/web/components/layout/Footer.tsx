"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { SiteSettingsView } from "@/lib/site/data";
import { formatPhoneHref, YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

function absoluteHttpUrl(value: string | undefined): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

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

export default function Footer({
  settings,
}: {
  settings?: SiteSettingsView | null;
}) {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const instagramHref = absoluteHttpUrl(settings?.instagram);
  const xiaohongshuHref = absoluteHttpUrl(settings?.xiaohongshu);

  return (
    <footer className="mt-auto bg-[var(--public-footer)] py-12 text-[var(--public-ink)]">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 font-serif text-xl font-bold">
              {YEZYY_BUSINESS_PROFILE.storeName}
            </h3>
            <p className="text-sm text-[var(--public-muted)]">{t("tagline")}</p>
            {(instagramHref ||
              xiaohongshuHref ||
              YEZYY_BUSINESS_PROFILE.xiaohongshu) && (
              <div className="mt-4 flex gap-3">
                {instagramHref && (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full p-2 text-[var(--public-muted)] transition-colors hover:text-[var(--public-pink)]"
                    aria-label="Instagram"
                  >
                    <InstagramIcon className="h-5 w-5" />
                  </a>
                )}
                {xiaohongshuHref ? (
                  <a
                    href={xiaohongshuHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full p-2 text-[var(--public-muted)] transition-colors hover:text-[var(--public-pink)]"
                    aria-label={t("xiaohongshu")}
                  >
                    <XiaohongshuIcon className="h-5 w-5" />
                  </a>
                ) : (
                  <span
                    className="flex items-center gap-2 text-sm text-[var(--public-muted)]"
                    aria-label={t("xiaohongshu")}
                  >
                    <XiaohongshuIcon className="h-5 w-5" />
                    <span>{YEZYY_BUSINESS_PROFILE.xiaohongshu}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <h4 className="mb-4 font-medium">{t("links")}</h4>
            <div className="flex flex-col gap-2 text-sm text-[var(--public-muted)]">
              <Link
                href="/projects"
                className="hover:text-[var(--public-pink)]"
              >
                {nav("projects")}
              </Link>
              <Link href="/parties" className="hover:text-[var(--public-pink)]">
                {nav("parties")}
              </Link>
              <Link href="/gallery" className="hover:text-[var(--public-pink)]">
                {nav("gallery")}
              </Link>
              <Link href="/contact" className="hover:text-[var(--public-pink)]">
                {nav("contact")}
              </Link>
            </div>
          </div>
          <div>
            <h4 className="mb-4 font-medium">{t("policies")}</h4>
            <div className="mb-6 flex flex-col gap-2 text-sm text-[var(--public-muted)]">
              <Link href="/privacy" className="hover:text-[var(--public-pink)]">
                {t("privacy")}
              </Link>
              <Link
                href="/booking-terms"
                className="hover:text-[var(--public-pink)]"
              >
                {t("bookingTerms")}
              </Link>
              <Link
                href="/cancellation-rescheduling"
                className="hover:text-[var(--public-pink)]"
              >
                {t("cancellation")}
              </Link>
              <Link
                href="/party-terms"
                className="hover:text-[var(--public-pink)]"
              >
                {t("partyTerms")}
              </Link>
            </div>
            <h4 className="mb-4 font-medium">{t("contact")}</h4>
            <div className="space-y-1 text-sm text-[var(--public-muted)]">
              <p>
                <a
                  className="hover:text-[var(--public-pink)]"
                  href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
                >
                  {YEZYY_BUSINESS_PROFILE.email}
                </a>
              </p>
              <p>
                <a
                  className="hover:text-[var(--public-pink)]"
                  href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
                >
                  {YEZYY_BUSINESS_PROFILE.phone}
                </a>
              </p>
              <p>{YEZYY_BUSINESS_PROFILE.address}</p>
              {YEZYY_BUSINESS_PROFILE.abn ? (
                <p>
                  {t("abn")}: {YEZYY_BUSINESS_PROFILE.abn}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-[var(--public-border)] pt-8 text-center text-sm text-[var(--public-muted)]">
          <p>
            © {new Date().getFullYear()} {YEZYY_BUSINESS_PROFILE.storeName}.{" "}
            {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
