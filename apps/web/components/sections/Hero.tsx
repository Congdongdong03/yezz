"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

export default function Hero({
  heroImageUrl,
  experienceEnabled = false,
}: {
  heroImageUrl?: string;
  experienceEnabled?: boolean;
}) {
  const t = useTranslations("hero");
  const nav = useTranslations("nav");

  return (
    <section
      className={`public-hero relative flex items-center justify-center overflow-hidden ${
        heroImageUrl ? "min-h-[80vh]" : "min-h-[32rem]"
      }`}
    >
      {heroImageUrl ? (
        <Image
          src={heroImageUrl}
          alt={`${YEZYY_BUSINESS_PROFILE.storeName} Studio`}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,_rgba(217,111,158,0.25),_transparent_32%),radial-gradient(circle_at_86%_78%,_rgba(229,200,211,0.9),_transparent_32%),linear-gradient(135deg,_#FBF8F6,_#F8E8EE_56%,_#FFF_100%)]" />
      )}
      <div className="absolute inset-0 bg-[var(--public-canvas)]/35" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        <p className="public-eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-4 text-4xl font-serif font-bold leading-[1.05] text-[var(--public-ink)] md:text-6xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--public-muted)] md:text-xl">
          {t("subtitle")}
        </p>
        <div className="mt-8">
          <Link
            href={experienceEnabled ? "/book" : "/projects"}
            className="inline-block rounded-full bg-[var(--public-pink)] px-8 py-3 text-lg font-medium text-white transition-transform hover:-translate-y-1"
          >
            {experienceEnabled ? t("cta") : nav("browseProjects")}
          </Link>
        </div>
      </div>
    </section>
  );
}
