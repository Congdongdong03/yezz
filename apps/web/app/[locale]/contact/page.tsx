import { loadSiteSettings } from "@/lib/site/data";
import { formatBusinessHours, formatPhoneHref, YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";
import { toGoogleMapsEmbedUrl } from "@/lib/site/maps";
import { buildPageMetadata } from "@/lib/site/metadata";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return buildPageMetadata({
    title: t("title"),
    description: t("metaDescription"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("contact");
  const settings = await loadSiteSettings();
  const businessHours = formatBusinessHours(locale);

  return (
    <div className="bg-[var(--public-canvas)] px-4 py-14 text-[var(--public-ink)] sm:py-20">
      <div className="mx-auto max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-pink)]">Visit YezYY</p>
      <h1 className="mt-3 text-4xl font-serif font-bold tracking-tight md:text-5xl">
        {t("title")}
      </h1>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl bg-[var(--public-paper)] p-7 shadow-sm sm:p-10">
          <div className="space-y-7">
          <div>
            <h2 className="font-medium">{t("address")}</h2>
            <p className="mt-2 leading-7 text-[var(--public-muted)]">{YEZYY_BUSINESS_PROFILE.address}</p>
          </div>
          <div>
            <h2 className="font-medium">{t("hours")}</h2>
            <p className="mt-2 leading-7 text-[var(--public-muted)]">{businessHours}</p>
          </div>
          <div>
            <h2 className="font-medium">{t("phone")}</h2>
            <a
              className="mt-2 inline-block text-[var(--public-pink)] hover:underline"
              href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
            >
              {YEZYY_BUSINESS_PROFILE.phone}
            </a>
          </div>
          <div>
            <h2 className="font-medium">{t("email")}</h2>
            <a
              className="mt-2 inline-block text-[var(--public-pink)] hover:underline"
              href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
            >
              {YEZYY_BUSINESS_PROFILE.email}
            </a>
          </div>
          {settings.wechatId && (
            <div>
              <h2 className="font-medium">{t("wechat")}</h2>
              <p className="mt-2 text-[var(--public-muted)]">{settings.wechatId}</p>
            </div>
          )}
          <div>
            <h2 className="font-medium">{t("xiaohongshu")}</h2>
            <p className="mt-2 text-[var(--public-muted)]">{YEZYY_BUSINESS_PROFILE.xiaohongshu}</p>
          </div>
          <div>
            <h2 className="font-medium">{t("map")}</h2>
            <a
              href={YEZYY_BUSINESS_PROFILE.googleMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-[var(--public-pink)] hover:underline"
            >
              {t("openInMaps")}
            </a>
          </div>
        </div></div>

        {settings.wechatQrCodeUrl && (
          <div className="flex flex-col items-center">
            <div className="relative h-64 w-64">
              <Image
                src={settings.wechatQrCodeUrl}
                alt="WeChat QR Code"
                fill
                className="rounded-lg object-contain"
              />
            </div>
            <p className="mt-4 text-sm text-[var(--public-muted)]">{t("scanWechat")}</p>
          </div>
        )}
      </div>

      <div className="mt-12 rounded-3xl bg-[var(--public-paper)] p-5 shadow-sm sm:p-7">
        <h2 className="font-medium">{t("map")}</h2>
        <iframe
          title={t("map")}
          src={toGoogleMapsEmbedUrl(YEZYY_BUSINESS_PROFILE.googleMapUrl)}
          className="mt-4 h-80 w-full rounded-2xl border border-[var(--public-border)]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div></div>
    </div>
  );
}
