import { loadSiteSettings } from "@/lib/site/data";
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

export default async function ContactPage() {
  const t = await getTranslations("contact");
  const settings = await loadSiteSettings();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        {t("title")}
      </h1>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          {settings.address && (
            <div>
              <h2 className="font-medium text-warm-charcoal">{t("address")}</h2>
              <p className="mt-2 text-warm-grey">{settings.address}</p>
            </div>
          )}
          {settings.businessHours && (
            <div>
              <h2 className="font-medium text-warm-charcoal">{t("hours")}</h2>
              <p className="mt-2 text-warm-grey">{settings.businessHours}</p>
            </div>
          )}
          {settings.phone && (
            <div>
              <h2 className="font-medium text-warm-charcoal">{t("phone")}</h2>
              <p className="mt-2 text-warm-grey">{settings.phone}</p>
            </div>
          )}
          {settings.email && (
            <div>
              <h2 className="font-medium text-warm-charcoal">{t("email")}</h2>
              <p className="mt-2 text-warm-grey">{settings.email}</p>
            </div>
          )}
          {settings.wechatId && (
            <div>
              <h2 className="font-medium text-warm-charcoal">{t("wechat")}</h2>
              <p className="mt-2 text-warm-grey">{settings.wechatId}</p>
            </div>
          )}
          {settings.googleMapUrl && (
            <div>
              <h2 className="font-medium text-warm-charcoal">{t("map")}</h2>
              <a
                href={settings.googleMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-caramel hover:underline"
              >
                {t("openInMaps")}
              </a>
            </div>
          )}
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
    </div>
  );
}
