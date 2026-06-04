import { getTranslations } from "next-intl/server";
import { client } from "@/lib/sanity/client";
import { siteSettingsQuery } from "@/lib/sanity/queries";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Contact | YEZZ",
    description: "Get in touch with YEZZ DIY Studio — visit us, add us on WeChat, or book your experience.",
  };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");

  let settings: {
    address?: string;
    phone?: string;
    email?: string;
    wechatId?: string;
    wechatQrCodeUrl?: string;
    instagram?: string;
    xiaohongshu?: string;
    businessHours?: string;
    googleMapUrl?: string;
  } | null = null;

  try {
    settings = await client.fetch(siteSettingsQuery);
  } catch {
    // Sanity unreachable — render without settings
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        {t("title")}
      </h1>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="space-y-6">
            {settings?.address && (
              <div>
                <h3 className="font-medium text-warm-charcoal">{t("address")}</h3>
                <p className="mt-1 text-warm-grey">{settings.address}</p>
              </div>
            )}
            {settings?.phone && (
              <div>
                <h3 className="font-medium text-warm-charcoal">{t("phone")}</h3>
                <p className="mt-1 text-warm-grey">{settings.phone}</p>
              </div>
            )}
            {settings?.email && (
              <div>
                <h3 className="font-medium text-warm-charcoal">{t("email")}</h3>
                <p className="mt-1 text-warm-grey">{settings.email}</p>
              </div>
            )}
            {settings?.businessHours && (
              <div>
                <h3 className="font-medium text-warm-charcoal">{t("businessHours")}</h3>
                <p className="mt-1 text-warm-grey">{settings.businessHours}</p>
              </div>
            )}
          </div>

          {/* WeChat */}
          {(settings?.wechatQrCodeUrl || settings?.wechatId) && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="font-medium text-warm-charcoal">WeChat</h3>
              {settings.wechatQrCodeUrl && (
                <div className="relative mt-3 aspect-square w-40 overflow-hidden rounded-lg">
                  <Image
                    src={settings.wechatQrCodeUrl}
                    alt="WeChat QR Code"
                    fill
                    sizes="160px"
                    className="object-contain"
                  />
                </div>
              )}
              {settings.wechatId && (
                <p className="mt-2 text-sm text-warm-grey">ID: {settings.wechatId}</p>
              )}
            </div>
          )}

          {/* Social Links */}
          {(settings?.instagram || settings?.xiaohongshu) && (
            <div className="flex gap-4">
              {settings.instagram && (
                <a
                  href={settings.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-cream px-4 py-2 text-sm font-medium text-warm-charcoal transition-colors hover:bg-caramel hover:text-white"
                >
                  Instagram
                </a>
              )}
              {settings.xiaohongshu && (
                <a
                  href={settings.xiaohongshu}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-cream px-4 py-2 text-sm font-medium text-warm-charcoal transition-colors hover:bg-caramel hover:text-white"
                >
                  小红书
                </a>
              )}
            </div>
          )}
        </div>

        {/* Google Map */}
        {settings?.googleMapUrl && (
          <div className="aspect-video overflow-hidden rounded-xl bg-muted">
            <iframe
              src={settings.googleMapUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </div>
  );
}
