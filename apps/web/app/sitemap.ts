import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site/url";

const publicPaths = ["/", "/projects", "/parties", "/gallery", "/contact"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of publicPaths) {
      const pathname = path === "/" ? `/${locale}` : `/${locale}${path}`;
      entries.push({
        url: `${baseUrl}${pathname}`,
        lastModified: new Date(),
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.8,
      });
    }
  }

  return entries;
}
