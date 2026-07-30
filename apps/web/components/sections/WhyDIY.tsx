"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Heart, Users, Gift, type LucideIcon } from "lucide-react";

const featureIcons: LucideIcon[] = [Heart, Users, Gift];
const featureKeys = ["stress", "bonding", "gifts"] as const;

export default function WhyDIY() {
  const t = useTranslations("home.whyDiy");

  return (
    <section className="public-section py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          {featureKeys.map((key, i) => {
            const Icon = featureIcons[i];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="public-value-card rounded-[1.75rem] bg-white p-8 transition-all hover:-translate-y-1"
              >
                <Icon className="h-10 w-10 text-caramel" />
                <h3 className="mt-4 text-xl font-serif font-bold text-warm-charcoal">
                  {t(`${key}Title`)}
                </h3>
                <p className="mt-2 text-sm text-warm-grey">{t(`${key}Desc`)}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
