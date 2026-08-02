import { loadGalleryPageData, loadSiteSettings } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import VisitStory from "@/components/visit/VisitStory";
import { selectStudioMedia } from "@/lib/site/studio-media";

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
    locale,
    pathname: "/contact",
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
  const selectedMedia = selectStudioMedia(
    galleryResult.ok ? galleryResult.data : [],
  );

  return (
    <div className="bg-[var(--public-canvas)] px-4 py-14 text-[var(--public-ink)] sm:py-20">
      <div className="mx-auto max-w-7xl">
        <VisitStory
          locale={locale}
          settings={settings}
          storeImage={selectedMedia.hero}
          arrivalImage={selectedMedia.arrival}
        />
      </div>
    </div>
  );
}
