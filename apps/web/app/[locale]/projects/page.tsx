import { getTranslations } from "next-intl/server";
import CatalogueSection from "@/components/catalogue/CatalogueSection";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { EmptyCatalogueState } from "@/components/EmptyCatalogueState";
import { loadCataloguePageData } from "@/lib/catalogue/data";
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

  const catalogueResult = await loadCataloguePageData();
  if (!catalogueResult.ok) {
    return <ServiceUnavailable />;
  }

  const entries = catalogueResult.data;
  const grouped = Array.from(
    entries.reduce((groups, entry) => {
      const key = entry.category.slug.current;
      const current = groups.get(key) ?? { category: entry.category, entries: [] };
      current.entries.push(entry);
      groups.set(key, current);
      return groups;
    }, new Map<string, { category: (typeof entries)[number]["category"]; entries: typeof entries }>() ).values(),
  ).sort((a, b) => a.category.order - b.category.order);

  return (
    <div className="public-catalogue min-h-screen bg-cream">
      <div className="border-b border-[var(--public-border)] bg-[linear-gradient(120deg,_#FBF8F6,_#F8E8EE_65%,_#FFF)]">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6 md:pb-14 md:pt-20">
          <p className="public-eyebrow">YezYY DIY Studio</p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold leading-tight text-warm-charcoal md:text-6xl">
          {t("title")}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-warm-grey md:text-lg">{t("subtitle")}</p>
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyCatalogueState
          locale={locale as "en" | "zh"}
          kind="projects"
          phone={YEZYY_BUSINESS_PROFILE.phone}
          email={YEZYY_BUSINESS_PROFILE.email}
        />
      ) : (
        <div className="divide-y divide-[var(--public-border)]">
          {grouped.map(({ category, entries: sectionEntries }) => (
            <CatalogueSection
              key={category.slug.current}
              category={category}
              entries={sectionEntries}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
