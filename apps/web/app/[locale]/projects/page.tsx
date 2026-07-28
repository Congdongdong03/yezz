import { getTranslations } from "next-intl/server";
import CategoryNav from "@/components/projects/CategoryNav";
import CategorySection from "@/components/projects/CategorySection";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { EmptyCatalogueState } from "@/components/EmptyCatalogueState";
import {
  groupProjectsByCategory,
  loadProjectsPageData,
} from "@/lib/projects/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import type { Metadata } from "next";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects" });
  return buildPageMetadata({
    title: t("title"),
    description: t("subtitle"),
  });
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("projects");

  const projectsResult = await loadProjectsPageData();
  if (!projectsResult.ok) {
    return <ServiceUnavailable />;
  }

  const { projects, categories } = projectsResult.data;
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

      {grouped.length === 0 ? (
        <EmptyCatalogueState
          locale={locale as "en" | "zh"}
          kind="projects"
          phone={YEZYY_BUSINESS_PROFILE.phone}
          email={YEZYY_BUSINESS_PROFILE.email}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
