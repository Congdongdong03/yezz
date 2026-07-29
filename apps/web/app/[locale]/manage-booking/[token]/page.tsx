import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import CustomerBookingActions from "@/components/book/CustomerBookingActions";
import {
  getCustomerBooking,
  type CustomerBookingView,
} from "@/lib/api/customer-booking";
import { resolveTrustedClientIp } from "@/lib/internal-api/signature";
import {
  YEZYY_BUSINESS_PROFILE,
  formatPhoneHref,
} from "@/lib/site/business";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function ContactDetails({ locale }: { locale: "en" | "zh" }) {
  return (
    <address className="mt-5 text-sm not-italic leading-7 text-warm-grey">
      <p>{YEZYY_BUSINESS_PROFILE.address}</p>
      <p>
        <a
          className="text-caramel underline-offset-4 hover:underline"
          href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
        >
          {YEZYY_BUSINESS_PROFILE.phone}
        </a>
        {" · "}
        <a
          className="text-caramel underline-offset-4 hover:underline"
          href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
        >
          {YEZYY_BUSINESS_PROFILE.email}
        </a>
      </p>
      <p>
        {locale === "zh" ? "小红书" : "Xiaohongshu"}:{" "}
        {YEZYY_BUSINESS_PROFILE.xiaohongshu}
      </p>
    </address>
  );
}

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: routeLocale, token } = await params;
  const fallbackLocale = routeLocale === "zh" ? "zh" : "en";
  let booking: CustomerBookingView | null = null;

  try {
    const requestHeaders = await headers();
    const trustedClientIp = resolveTrustedClientIp(requestHeaders);
    booking = await getCustomerBooking(
      token,
      trustedClientIp,
    );
  } catch {
    booking = null;
  }

  if (!booking) {
    const t = await getTranslations({
      locale: fallbackLocale,
      namespace: "customerBooking",
    });
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-16 sm:px-6">
        <section className="w-full rounded-3xl border border-warm-grey/15 bg-white p-7 text-center shadow-sm sm:p-10">
          <h1 className="font-serif text-3xl font-bold text-warm-charcoal">
            {t("invalidTitle")}
          </h1>
          <p className="mt-4 text-sm leading-6 text-warm-grey">
            {t("invalidBody")}
          </p>
          <ContactDetails locale={fallbackLocale} />
        </section>
      </main>
    );
  }

  const t = await getTranslations({
    locale: booking.locale,
    namespace: "customerBooking",
  });
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-caramel">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-warm-charcoal sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-warm-grey">
          {t("intro")}
        </p>
      </header>
      <CustomerBookingActions booking={booking} />
      <footer className="mt-8 rounded-3xl border border-warm-grey/15 bg-white p-6 text-center">
        <ContactDetails locale={booking.locale} />
      </footer>
    </main>
  );
}
