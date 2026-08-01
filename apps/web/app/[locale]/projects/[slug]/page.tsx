import { notFound } from "next/navigation";
import CatalogueDetail from "@/components/catalogue/CatalogueDetail";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { loadCatalogueEntry } from "@/lib/catalogue/data";
import { loadSiteSettings } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const result = await loadCatalogueEntry(slug);
  if (!result.ok || !result.data) {
    return buildPageMetadata({
      title: slug.replace(/-/g, " "),
      locale,
      pathname: `/projects/${slug}`,
    });
  }
  const name =
    result.data.name[locale as "en" | "zh"] ?? slug.replace(/-/g, " ");
  const description =
    result.data.description[locale as "en" | "zh"] ??
    result.data.description?.en;
  return buildPageMetadata({
    title: name,
    description: description ?? undefined,
    locale,
    pathname: `/projects/${slug}`,
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const [result, settings] = await Promise.all([
    loadCatalogueEntry(slug),
    loadSiteSettings(),
  ]);

  if (!result.ok) {
    return <ServiceUnavailable />;
  }

  if (!result.data) {
    notFound();
  }

  return (
    <CatalogueDetail
      entry={result.data}
      locale={locale}
      requestEnabled={settings.requestCapabilities.experience}
    />
  );
}
