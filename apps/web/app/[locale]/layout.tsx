import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import LocaleRouteChrome from "@/components/public/LocaleRouteChrome";
import HtmlLang from "@/components/layout/HtmlLang";
import { buildPageMetadata } from "@/lib/site/metadata";
import { loadSiteSettings } from "@/lib/site/data";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`@/lib/i18n/messages/${locale}.json`)).default;
  await loadSiteSettings();
  return buildPageMetadata({
    description: messages.metadata.description,
  });
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "zh")) {
    notFound();
  }

  const messages = await getMessages();
  const siteSettings = await loadSiteSettings();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <HtmlLang locale={locale} />
      <LocaleRouteChrome
        capabilities={siteSettings.requestCapabilities}
        settings={siteSettings}
      >
        {children}
      </LocaleRouteChrome>
    </NextIntlClientProvider>
  );
}
