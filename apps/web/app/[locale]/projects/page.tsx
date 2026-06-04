import { client } from "@/lib/sanity/client";
import { projectsQuery, categoriesQuery } from "@/lib/sanity/queries";
import { mockProjects, mockCategories } from "@/lib/sanity/mock-data";
import { getTranslations } from "next-intl/server";
import CategoryNav from "@/components/projects/CategoryNav";
import CategorySection from "@/components/projects/CategorySection";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "DIY Projects | YEZZ",
    description: "Explore our DIY projects — cream glue, beads, pottery, LEGO, candles, and more. Find your perfect creative experience.",
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

  let projects: any[] = [];
  let categories: any[] = [];

  try {
    [projects, categories] = await Promise.all([
      client.fetch(projectsQuery),
      client.fetch(categoriesQuery),
    ]);
  } catch {
    // Sanity unreachable
  }

  if (!projects || projects.length === 0) projects = mockProjects;
  if (!categories || categories.length === 0) categories = mockCategories;

  // Sort categories by order field
  let displayCategories = [...categories].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  // Group projects by category slug
  let grouped = displayCategories
    .map((cat) => ({
      category: cat,
      projects: projects.filter(
        (p) => p.category?.slug?.current === cat.slug.current
      ),
    }))
    .filter((g) => g.projects.length > 0);

  // Fallback to mock data if Sanity returned empty or broken categories
  if (grouped.length === 0) {
    const fallbackProjects = mockProjects;
    const fallbackCategories = mockCategories;
    displayCategories = [...fallbackCategories].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    grouped = displayCategories
      .map((cat) => ({
        category: cat,
        projects: fallbackProjects.filter(
          (p) => p.category?.slug?.current === cat.slug.current
        ),
      }))
      .filter((g) => g.projects.length > 0);
  }

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
        {grouped.map(({ category, projects }) => (
          <CategorySection
            key={category.slug.current}
            category={category}
            projects={projects}
          />
        ))}
      </div>
    </div>
  );
}
