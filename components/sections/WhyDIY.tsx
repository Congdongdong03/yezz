"use client";

import { useLocale } from "next-intl";
import { motion } from "framer-motion";
import { Heart, Users, Gift } from "lucide-react";

const features = [
  {
    icon: Heart,
    title: "Relieve Stress",
    titleZh: "放松心情",
    desc: "Take a break and create something beautiful with your hands.",
    descZh: "暂时放下烦恼，用双手创造美好。",
  },
  {
    icon: Users,
    title: "Bonding Time",
    titleZh: "增进感情",
    desc: "Perfect for dates, friends, and family to connect.",
    descZh: "约会、闺蜜、亲子，一起度过有意义的时光。",
  },
  {
    icon: Gift,
    title: "Unique Gifts",
    titleZh: "独一无二",
    desc: "Make a one-of-a-kind gift that carries your heart.",
    descZh: "亲手制作的礼物，承载着满满的心意。",
  },
];

export default function WhyDIY() {
  const locale = useLocale();
  const isZh = locale === "zh";

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="rounded-2xl bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <feature.icon className="h-10 w-10 text-caramel" />
              <h3 className="mt-4 text-xl font-serif font-bold text-warm-charcoal">
                {isZh ? feature.titleZh : feature.title}
              </h3>
              <p className="mt-2 text-sm text-warm-grey">
                {isZh ? feature.descZh : feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
