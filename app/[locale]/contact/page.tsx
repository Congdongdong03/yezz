import { client } from "@/lib/sanity/client";
import { siteSettingsQuery } from "@/lib/sanity/queries";

export default async function ContactPage() {
  const settings = await client.fetch(siteSettingsQuery);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        Get in Touch
      </h1>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          {settings?.address && (
            <div>
              <h3 className="font-medium text-warm-charcoal">Address</h3>
              <p className="mt-1 text-warm-grey">{settings.address}</p>
            </div>
          )}
          {settings?.phone && (
            <div>
              <h3 className="font-medium text-warm-charcoal">Phone</h3>
              <p className="mt-1 text-warm-grey">{settings.phone}</p>
            </div>
          )}
          {settings?.email && (
            <div>
              <h3 className="font-medium text-warm-charcoal">Email</h3>
              <p className="mt-1 text-warm-grey">{settings.email}</p>
            </div>
          )}
          {settings?.businessHours && (
            <div>
              <h3 className="font-medium text-warm-charcoal">Business Hours</h3>
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
