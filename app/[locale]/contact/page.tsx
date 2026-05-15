import { getTranslations } from "next-intl/server";
import { client } from "@/lib/sanity/client";
import { siteSettingsQuery } from "@/lib/sanity/queries";

export default async function ContactPage() {
  const t = await getTranslations("contact");

  let settings = null;
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
