"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Hero({ heroImageUrl }: { heroImageUrl?: string }) {
  const t = useTranslations("hero");

  return (
    <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
      {heroImageUrl ? (
        <Image
          src={heroImageUrl}
          alt="YEZZ Studio"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-cream via-cream to-soft-pink/20" />
      )}
      <div className="absolute inset-0 bg-cream/40" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-serif font-bold leading-tight text-warm-charcoal md:text-6xl"
        >
          {t("title")}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-lg text-warm-grey md:text-xl"
        >
          {t("subtitle")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8"
        >
          <Link
            href="/projects"
            className="inline-block rounded-full bg-caramel px-8 py-3 text-lg font-medium text-white transition-transform hover:-translate-y-1"
          >
            {t("cta")}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
