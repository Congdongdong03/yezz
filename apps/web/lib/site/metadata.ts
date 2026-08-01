import type { Metadata } from "next";
import { loadSiteSettings } from "@/lib/site/data";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

type PageMetaOptions = {
  title?: string;
  description?: string;
  locale?: string;
  pathname?: string;
};

function localizedPath(locale: "en" | "zh", pathname = "/"): string {
  const suffix = pathname === "/" ? "" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
  return `/${locale}${suffix}`;
}

export async function buildPageMetadata(options: PageMetaOptions = {}): Promise<Metadata> {
  const settings = await loadSiteSettings();
  const siteTitle = settings.seoTitle ?? YEZYY_BUSINESS_PROFILE.storeName;
  const siteDescription =
    settings.seoDescription ??
    `${YEZYY_BUSINESS_PROFILE.storeName} — ${YEZYY_BUSINESS_PROFILE.address}`;

  const title = options.title ? `${options.title} | ${siteTitle}` : siteTitle;
  const description = options.description ?? siteDescription;
  const locale = options.locale === "zh" ? "zh" : "en";
  const canonical = localizedPath(locale, options.pathname);
  const languages = {
    en: localizedPath("en", options.pathname),
    "zh-CN": localizedPath("zh", options.pathname),
  };

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      locale: locale === "zh" ? "zh_CN" : "en_AU",
      alternateLocale: locale === "zh" ? ["en_AU"] : ["zh_CN"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
