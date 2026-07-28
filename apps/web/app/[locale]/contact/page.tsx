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
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        {t("title")}
      </h1>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h2 className="font-medium text-warm-charcoal">{t("address")}</h2>
            <p className="mt-2 text-warm-grey">{YEZYY_BUSINESS_PROFILE.address}</p>
          </div>
          <div>
            <h2 className="font-medium text-warm-charcoal">{t("hours")}</h2>
            <p className="mt-2 text-warm-grey">{businessHours}</p>
          </div>
          <div>
            <h2 className="font-medium text-warm-charcoal">{t("phone")}</h2>
            <a
              className="mt-2 inline-block text-warm-grey hover:text-caramel hover:underline"
              href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
            >
              {YEZYY_BUSINESS_PROFILE.phone}
            </a>
          </div>
          <div>
            <h2 className="font-medium text-warm-charcoal">{t("email")}</h2>
            <a
              className="mt-2 inline-block text-warm-grey hover:text-caramel hover:underline"
              href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
            >
              {YEZYY_BUSINESS_PROFILE.email}
            </a>
          </div>
          {settings.wechatId && (
            <div>
              <h2 className="font-medium text-warm-charcoal">{t("wechat")}</h2>
              <p className="mt-2 text-warm-grey">{settings.wechatId}</p>
            </div>
          )}
          <div>
            <h2 className="font-medium text-warm-charcoal">{t("xiaohongshu")}</h2>
            <p className="mt-2 text-warm-grey">{YEZYY_BUSINESS_PROFILE.xiaohongshu}</p>
          </div>
          <div>
            <h2 className="font-medium text-warm-charcoal">{t("map")}</h2>
            <a
              href={YEZYY_BUSINESS_PROFILE.googleMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-caramel hover:underline"
            >
              {t("openInMaps")}
            </a>
          </div>
        </div>

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
            <p className="mt-4 text-sm text-warm-grey">{t("scanWechat")}</p>
          </div>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-medium text-warm-charcoal">{t("map")}</h2>
        <iframe
          title={t("map")}
          src={toGoogleMapsEmbedUrl(YEZYY_BUSINESS_PROFILE.googleMapUrl)}
          className="mt-4 h-80 w-full rounded-xl border border-warm-grey/15"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
}
