import { loadGalleryPageData } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { EmptyCatalogueState } from "@/components/EmptyCatalogueState";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { Metadata } from "next";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

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

  const images = galleryResult.data;
  const publishableImages = images.filter(
    (img: { _id: string; imageUrl?: string }) => img.imageUrl,
  );

  return (
    <div className="bg-[var(--public-canvas)] px-4 py-14 text-[var(--public-ink)] sm:py-20">
      <div className="mx-auto max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-pink)]">YezYY studio diary</p>
      <h1 className="mt-3 text-4xl font-serif font-bold tracking-tight md:text-5xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--public-muted)]">{t("subtitle")}</p>

      {publishableImages.length === 0 ? (
        <EmptyCatalogueState
          locale={locale as "en" | "zh"}
          kind="gallery"
          phone={YEZYY_BUSINESS_PROFILE.phone}
          email={YEZYY_BUSINESS_PROFILE.email}
        />
      ) : (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publishableImages.map(
            (img: {
              _id: string;
              imageUrl: string;
              caption?: { en?: string; zh?: string };
            }) => (
              <div
                key={img._id}
                className="relative aspect-square overflow-hidden rounded-3xl bg-[var(--public-rose-paper)] shadow-sm"
              >
                <Image
                  src={img.imageUrl}
                  alt={
                    img.caption?.[locale as "en" | "zh"] ||
                    img.caption?.en ||
                    t("imageAlt")
                  }
                  sizes="(max-width: 768px) 50vw, 33vw"
                  fill
                  className="object-cover transition-transform hover:scale-105"
                />
              </div>
            ),
          )}
        </div>
      )}</div>
    </div>
  );
}
