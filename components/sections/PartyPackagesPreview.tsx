"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";

interface PartyPackage {
  _id: string;
  name: { en: string; zh: string };
  slug: { current: string };
  description?: { en: string; zh: string };
  imageUrl?: string;
  minPeople?: number;
  maxPeople?: number;
  priceIndicator?: string;
}

interface PartyPackagesPreviewProps {
  packages: PartyPackage[];
}

export default function PartyPackagesPreview({ packages }: PartyPackagesPreviewProps) {
  const t = useTranslations("home.partyPackages");
  const locale = useLocale();

  if (packages.length === 0) return null;

  return (
    <section className="py-20 bg-white">
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
            href="/parties"
            className="text-sm font-medium text-caramel hover:underline"
          >
            {t("viewAll")} →
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {packages.map((pkg, i) => (
            <motion.div
              key={pkg._id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="group overflow-hidden rounded-2xl bg-cream transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                {pkg.imageUrl ? (
                  <Image
                    src={pkg.imageUrl}
                    alt={pkg.name[locale as "en" | "zh"]}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <span className="text-muted-foreground">
                      {locale === "zh" ? "暂无图片" : "No image"}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-serif font-bold text-warm-charcoal">
                  {pkg.name[locale as "en" | "zh"]}
                </h3>
                {pkg.description && (
                  <p className="mt-2 text-sm text-warm-grey line-clamp-2">
                    {pkg.description[locale as "en" | "zh"]}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-warm-grey">
                    {pkg.minPeople && pkg.maxPeople && (
                      <span>
                        {pkg.minPeople}-{pkg.maxPeople} {t("people")}
                      </span>
                    )}
                  </div>
                  {pkg.priceIndicator && (
                    <span className="text-sm font-medium text-caramel">
                      {pkg.priceIndicator}
                    </span>
                  )}
                </div>
                <Link
                  href={`/parties`}
                  className="mt-4 inline-block rounded-full bg-caramel px-6 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {t("viewAll")}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
