import { getTranslations } from "next-intl/server";
import CategoryNav from "@/components/projects/CategoryNav";
import CategorySection from "@/components/projects/CategorySection";
import {
  groupProjectsByCategory,
  loadProjectsPageData,
} from "@/lib/projects/data";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "DIY Projects | YEZZ",
    description:
      "Explore our DIY projects — cream glue, beads, pottery, LEGO, candles, and more. Find your perfect creative experience.",
  };
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: _locale } = await params;
  void _locale;
  const t = await getTranslations("projects");

  const { projects, categories } = await loadProjectsPageData();
  const { displayCategories, grouped } = groupProjectsByCategory(
    projects,
    categories,
  );

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-12">
        <h1 className="font-serif text-3xl font-bold text-warm-charcoal md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-warm-grey">{t("subtitle")}</p>
      </div>

      <CategoryNav categories={displayCategories} />

      <div className="divide-y divide-warm-grey/10">
        {grouped.map(({ category, projects: sectionProjects }) => (
          <CategorySection
            key={category.slug.current}
            category={category}
            projects={sectionProjects}
          />
        ))}
      </div>
    </div>
  );
}
