import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site/url";
import { fetchProjects } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/config";

const staticPaths = ["/", "/projects", "/parties", "/gallery", "/contact"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const locale of routing.locales) {
    for (const path of staticPaths) {
      const pathname = path === "/" ? `/${locale}` : `/${locale}${path}`;
      entries.push({
        url: `${baseUrl}${pathname}`,
        lastModified: now,
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.8,
      });
    }
  }

  if (isApiEnabled()) {
    try {
      const projects = await fetchProjects();
      for (const project of projects) {
        const slug = project.slug;
        if (!slug) continue;
        for (const locale of routing.locales) {
          entries.push({
            url: `${baseUrl}/${locale}/projects/${slug}`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.7,
          });
        }
      }
    } catch {
      // API unavailable — sitemap falls back to static routes only
    }
  }

  return entries;
}
