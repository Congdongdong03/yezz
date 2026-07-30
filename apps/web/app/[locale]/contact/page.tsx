import { loadGalleryPageData, loadSiteSettings } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import VisitStory from "@/components/visit/VisitStory";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return buildPageMetadata({
    title: t("title"),
    description: t("metaDescription"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  const [settings, galleryResult] = await Promise.all([
    loadSiteSettings(),
    loadGalleryPageData(),
  ]);
  const storeImage = galleryResult.ok
    ? galleryResult.data.find((image) => image.category === "store") ?? null
    : null;

  return (
    <div className="bg-[var(--public-canvas)] px-4 py-14 text-[var(--public-ink)] sm:py-20">
      <div className="mx-auto max-w-7xl">
        <VisitStory locale={locale} settings={settings} storeImage={storeImage} />
      </div>
    </div>
  );
}
