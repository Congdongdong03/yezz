"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

export default function Hero({ heroImageUrl }: { heroImageUrl?: string }) {
  const t = useTranslations("hero");

  return (
    <section
      className={`relative flex items-center justify-center overflow-hidden ${
        heroImageUrl ? "min-h-[80vh]" : "min-h-[32rem]"
      }`}
    >
      {heroImageUrl ? (
        <Image
          src={heroImageUrl}
          alt={`${YEZYY_BUSINESS_PROFILE.storeName} Studio`}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(230,172,174,0.45),_transparent_40%),linear-gradient(135deg,_var(--color-cream),_#fff7f2_55%,_rgba(230,172,174,0.22))]" />
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
            href="/book"
            className="inline-block rounded-full bg-caramel px-8 py-3 text-lg font-medium text-white transition-transform hover:-translate-y-1"
          >
            {t("cta")}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
