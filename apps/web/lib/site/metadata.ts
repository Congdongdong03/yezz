import type { Metadata } from "next";
import { loadSiteSettings } from "@/lib/site/data";

type PageMetaOptions = {
  title?: string;
  description?: string;
};

export async function buildPageMetadata(options: PageMetaOptions = {}): Promise<Metadata> {
  const settings = await loadSiteSettings();
  const siteTitle = settings.seoTitle ?? "YEZZ DIY Studio";
  const siteDescription =
    settings.seoDescription ?? siteTitle;

  const title = options.title ? `${options.title} | ${siteTitle}` : siteTitle;
  const description = options.description ?? siteDescription;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}
