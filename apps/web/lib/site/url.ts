import { YEZYY_BUSINESS_PROFILE } from "./business";

/** Public site origin for sitemap, robots, and absolute metadata URLs. */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return YEZYY_BUSINESS_PROFILE.website;
}
