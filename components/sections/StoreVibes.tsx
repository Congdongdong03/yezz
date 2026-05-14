"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";

interface StoreVibesProps {
  storeImage?: {
    _id: string;
    imageUrl?: string;
    caption?: { en: string; zh: string };
  } | null;
}

export default function StoreVibes({ storeImage }: StoreVibesProps) {
  const t = useTranslations("home.storeVibes");
  const locale = useLocale();

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl"
          >
            {storeImage?.imageUrl ? (
              <Image
                src={storeImage.imageUrl}
                alt={storeImage.caption?.[locale as "en" | "zh"] || "YEZZ Studio"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-cream">
                <span className="text-warm-grey">YEZZ Studio</span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-warm-grey">
              {t("desc")}
            </p>
            <Link
              href="/contact"
              className="mt-8 inline-block rounded-full bg-caramel px-8 py-3 text-lg font-medium text-white transition-transform hover:-translate-y-1"
            >
              {t("cta")}
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
