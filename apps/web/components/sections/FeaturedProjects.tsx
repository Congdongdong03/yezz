"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import ProjectCard from "@/components/projects/ProjectCard";

interface Project {
  _id: string;
  name: { en: string; zh: string };
  slug: { current: string };
  imageUrl?: string;
  priceRange?: string;
  duration?: string;
  tags?: string[];
}

interface FeaturedProjectsProps {
  projects: Project[];
}

export default function FeaturedProjects({ projects }: FeaturedProjectsProps) {
  const t = useTranslations("home.featuredProjects");
  const locale = useLocale();

  if (projects.length === 0) return null;

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
          <div>
            <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/projects"
            className="text-sm font-medium text-caramel hover:underline"
          >
            {t("viewAll")} →
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
