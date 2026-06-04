import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { CartProvider } from "@/lib/cart/context";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import CartToast from "@/components/cart/CartToast";
import ErrorBoundary from "@/components/ErrorBoundary";
import HtmlLang from "@/components/layout/HtmlLang";
import { loadSiteSettings } from "@/lib/site/data";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`@/lib/i18n/messages/${locale}.json`)).default;
  const settings = await loadSiteSettings();
  return {
    title: settings.seoTitle ?? messages.metadata.title,
    description: settings.seoDescription ?? messages.metadata.description,
  };
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
      <CartProvider>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <Footer settings={siteSettings} />
          <CartDrawer />
          <CartToast />
        </div>
      </CartProvider>
    </NextIntlClientProvider>
  );
}
