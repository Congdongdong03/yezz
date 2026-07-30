"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

type StudioVisitPreviewProps = {
  storeImage: {
    _id: string;
    imageUrl?: string;
    caption?: { en: string; zh: string };
  } | null;
};

export default function StudioVisitPreview({
  storeImage,
}: StudioVisitPreviewProps) {
  const locale = useLocale() as "en" | "zh";
  const t = useTranslations("home.storeVibes");

  return (
    <section className="bg-[var(--public-paper)] py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl overflow-hidden border border-[var(--public-border)] lg:grid-cols-2">
        <div className="relative min-h-[22rem] bg-[var(--public-rose-paper)]">
          {storeImage?.imageUrl ? (
            <Image
              src={storeImage.imageUrl}
              alt={
                storeImage.caption?.[locale] ??
                YEZYY_BUSINESS_PROFILE.storeName + " studio"
              }
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center font-serif text-2xl text-[var(--public-muted)]">
              {YEZYY_BUSINESS_PROFILE.storeName} studio
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between p-7 sm:p-12">
          <div>
            <p className="public-eyebrow">{t("eyebrow")}</p>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[var(--public-ink)]">
              {t("title")}
            </h2>
            <p className="mt-6 max-w-md leading-8 text-[var(--public-muted)]">
              {t("desc")}
            </p>
          </div>
          <Link
            href="/contact"
            className="mt-10 w-fit rounded-full bg-[var(--public-pink)] px-6 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
