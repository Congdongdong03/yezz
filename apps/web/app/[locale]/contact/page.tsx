import { loadSiteSettings } from "@/lib/site/data";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Contact | YEZZ",
    description:
      "Get in touch with YEZZ DIY Studio — visit us, add us on WeChat, or book your experience.",
  };
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
