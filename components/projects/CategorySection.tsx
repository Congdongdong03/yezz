"use client";

import { useLocale } from "next-intl";
import { motion } from "framer-motion";
import {
  Palette,
  Gem,
  Box,
  Sparkles,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import ProjectCard from "./ProjectCard";

const iconMap: Record<string, LucideIcon> = {
  palette: Palette,
  gem: Gem,
  box: Box,
  "party-popper": PartyPopper,
  sparkles: Sparkles,
};

interface Project {
  _id: string;
  name: { en: string; zh: string };
  imageUrl?: string;
  priceRange?: string;
  duration?: string;
  tags?: string[];
}

interface Category {
  slug: { current: string };
  name: { en: string; zh: string };
  description?: { en: string; zh: string };
  icon?: string;
}

interface CategorySectionProps {
  category: Category;
  projects: Project[];
}

export default function CategorySection({
  category,
  projects,
}: CategorySectionProps) {
  const locale = useLocale();
  const Icon = category.icon ? iconMap[category.icon] : null;

  return (
    <section id={category.slug.current} className="scroll-mt-32 py-16">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            {Icon && <Icon className="h-7 w-7 text-caramel" />}
            <h2 className="font-serif text-2xl font-bold text-warm-charcoal md:text-3xl">
              {category.name[locale as "en" | "zh"]}
            </h2>
          </div>
          {category.description && (
            <p className="mt-2 text-warm-grey">
              {category.description[locale as "en" | "zh"]}
            </p>
          )}
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <ProjectCard project={project} locale={locale} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
