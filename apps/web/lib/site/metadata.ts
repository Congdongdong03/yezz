import type { Metadata } from "next";
import { loadSiteSettings } from "@/lib/site/data";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

type PageMetaOptions = {
  title?: string;
  description?: string;
};

export async function buildPageMetadata(options: PageMetaOptions = {}): Promise<Metadata> {
  const settings = await loadSiteSettings();
  const siteTitle = settings.seoTitle ?? YEZYY_BUSINESS_PROFILE.storeName;
  const siteDescription =
    settings.seoDescription ??
    `${YEZYY_BUSINESS_PROFILE.storeName} — ${YEZYY_BUSINESS_PROFILE.address}`;

  const title = options.title ? `${options.title} | ${siteTitle}` : siteTitle;
  const description = options.description ?? siteDescription;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
