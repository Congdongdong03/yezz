import { loadGalleryPageData } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-4 text-warm-grey">{t("subtitle")}</p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images
          .filter((img: { _id: string; imageUrl?: string }) => img.imageUrl)
          .map(
            (img: {
              _id: string;
              imageUrl: string;
              caption?: { en?: string; zh?: string };
            }) => (
              <div
                key={img._id}
                className="relative aspect-square overflow-hidden rounded-lg"
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
    </div>
  );
}
