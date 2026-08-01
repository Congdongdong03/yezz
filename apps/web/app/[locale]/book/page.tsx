import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import OrdinaryBookingForm from "@/components/book/OrdinaryBookingForm";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { loadProjectsPageData } from "@/lib/projects/data";
import { loadSiteSettings } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ordinaryBooking" });
  return buildPageMetadata({
    title: t("pageTitle"),
    description: t("metadataDescription"),
    locale,
    pathname: "/book",
  });
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const pageLocale = locale === "zh" ? "zh" : "en";
  const t = await getTranslations({
    locale: pageLocale,
    namespace: "ordinaryBooking",
  });
  const [settings, projectsResult] = await Promise.all([
    loadSiteSettings(),
    loadProjectsPageData(),
  ]);
  const requestEnabled = settings.requestCapabilities.experience;

  if (requestEnabled && !projectsResult.ok) {
    return <ServiceUnavailable />;
  }

  const projects = projectsResult.ok
    ? projectsResult.data.projects
        .filter(
          (project) =>
            project.projectType === "experience" &&
            project.bookable &&
            (project.durationMinutes === 30 ||
              project.durationMinutes === 60),
        )
        .map((project) => ({
          id: project._id,
          name: project.name,
          durationMinutes: project.durationMinutes as 30 | 60,
          priceDisplay: project.priceDisplay,
        }))
    : [];

  return (
    <main className="min-h-screen bg-cream pb-20">
      <header className="border-b border-[var(--public-border)] bg-[linear-gradient(120deg,_#FBF8F6,_#F8E8EE_65%,_#FFF)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 max-w-3xl font-serif text-3xl font-bold leading-tight text-warm-charcoal sm:text-5xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-warm-grey">
            {t("pageIntro")}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm text-warm-charcoal">
            {[t("factProjects"), t("factCapacity"), t("factPayment")].map(
              (fact) => (
                <span
                  className="rounded-full border border-[var(--public-border)] bg-white/85 px-4 py-2"
                  key={fact}
                >
                  {fact}
                </span>
              ),
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <OrdinaryBookingForm
          locale={pageLocale}
          projects={projects}
          requestEnabled={requestEnabled}
        />
      </div>
    </main>
  );
}
