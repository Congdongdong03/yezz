"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";

interface GalleryImage {
  _id: string;
  imageUrl?: string;
  category?: string;
  caption?: { en: string; zh: string };
}

interface GalleryHighlightProps {
  images: GalleryImage[];
}

const categoryLabels: Record<string, { en: string; zh: string }> = {
  couple: { en: "Couple", zh: "情侣" },
  birthday: { en: "Birthday", zh: "生日" },
  kids: { en: "Kids", zh: "儿童" },
  gift: { en: "Gift", zh: "礼物" },
  store: { en: "Store", zh: "店铺" },
  works: { en: "Works", zh: "作品" },
};

export default function GalleryHighlight({ images }: GalleryHighlightProps) {
  const t = useTranslations("home.gallery");
  const locale = useLocale();

  if (images.length === 0) return null;

  return (
    <section className="py-20 bg-cream">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="flex items-end justify-between"
        >
          <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
            {t("title")}
          </h2>
          <Link
            href="/gallery"
            className="text-sm font-medium text-caramel hover:underline"
          >
            {t("viewAll")} →
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <motion.div
              key={img._id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group relative aspect-square overflow-hidden rounded-xl"
            >
              {img.imageUrl ? (
                <Image
                  src={img.imageUrl}
                  alt={img.caption?.[locale as "en" | "zh"] || ""}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted">
                  <span className="text-muted-foreground">
                    {locale === "zh" ? "暂无图片" : "No image"}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              {img.category && categoryLabels[img.category] && (
                <div className="absolute bottom-4 left-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-warm-charcoal">
                    {categoryLabels[img.category][locale as "en" | "zh"]}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
