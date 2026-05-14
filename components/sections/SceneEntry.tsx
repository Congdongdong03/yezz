"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { Heart, Cake, Palette } from "lucide-react";

const scenes = [
  {
    key: "date" as const,
    icon: Heart,
    href: "/projects" as const,
    color: "bg-soft-pink/20",
    iconColor: "text-soft-pink",
  },
  {
    key: "birthday" as const,
    icon: Cake,
    href: "/parties" as const,
    color: "bg-sage/20",
    iconColor: "text-sage",
  },
  {
    key: "diy" as const,
    icon: Palette,
    href: "/projects" as const,
    color: "bg-lavender/20",
    iconColor: "text-lavender",
  },
];

export default function SceneEntry() {
  const t = useTranslations("home.sceneEntry");

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-warm-grey">{t("subtitle")}</p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {scenes.map((scene, i) => (
            <motion.div
              key={scene.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Link
                href={scene.href}
                className="group block rounded-2xl bg-cream p-8 text-center transition-shadow hover:shadow-md"
              >
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${scene.color}`}
                >
                  <scene.icon
                    className={`h-8 w-8 ${scene.iconColor}`}
                  />
                </div>
                <h3 className="mt-6 text-xl font-serif font-bold text-warm-charcoal">
                  {t(`${scene.key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-warm-grey">
                  {t(`${scene.key}.desc`)}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
