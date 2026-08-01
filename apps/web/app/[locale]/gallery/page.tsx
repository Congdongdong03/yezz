import { loadGalleryPageData } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import EditorialGallery from "@/components/gallery/EditorialGallery";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return buildPageMetadata({
    title: t("title"),
    description: t("subtitle"),
    locale,
    pathname: "/gallery",
  });
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("gallery");
  const galleryResult = await loadGalleryPageData();

  if (!galleryResult.ok) {
    return <ServiceUnavailable />;
  }

  return (
    <div className="bg-[var(--public-canvas)] px-4 py-14 text-[var(--public-ink)] sm:py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-pink)]">
          YezYY studio diary
        </p>
        <h1 className="mt-3 text-4xl font-serif font-bold tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--public-muted)]">
          {t("subtitle")}
        </p>
        <div className="mt-12">
          <EditorialGallery
            locale={locale as "en" | "zh"}
            images={galleryResult.data}
          />
        </div>
      </div>
    </div>
  );
}
