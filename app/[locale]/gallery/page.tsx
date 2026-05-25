import { client } from "@/lib/sanity/client";
import { galleryQuery } from "@/lib/sanity/queries";
import { mockGalleryImages } from "@/lib/sanity/mock-data";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Gallery | YEZZ",
    description: "Browse our community's creations — from handmade gifts to party moments. Get inspired at YEZZ DIY Studio.",
  };
}

export default async function GalleryPage() {
  const t = await getTranslations("gallery");

  let images;
  try {
    images = await client.fetch(galleryQuery);
  } catch {
    // Sanity unreachable
  }
  if (!images || images.length === 0) images = mockGalleryImages;

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
                  alt={img.caption?.en || "Gallery image"}
                  sizes="(max-width: 768px) 50vw, 33vw"
                  fill
                  className="object-cover transition-transform hover:scale-105"
                />
              </div>
            )
          )}
      </div>
    </div>
  );
}
