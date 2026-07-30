"use client";

import Image from "next/image";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type EditorialProject = {
  _id: string;
  name: { en: string; zh: string };
  slug: { current: string };
  imageUrl?: string;
  priceDisplay?: string;
  priceRange?: string;
  duration?: string;
};

export default function EditorialProjects({
  projects,
}: {
  projects: EditorialProject[];
}) {
  const locale = useLocale() as "en" | "zh";
  const t = useTranslations("home.editorialProjects");
  const featuredProjects = projects.slice(0, 3);

  if (featuredProjects.length === 0) {
    return null;
  }

  return (
    <section className="bg-[var(--public-canvas)] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-5 border-b border-[var(--public-border)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="public-eyebrow">{t("eyebrow")}</p>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[var(--public-ink)] sm:text-5xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/projects"
            className="w-fit border-b border-[var(--public-pink)] pb-1 text-sm font-medium text-[var(--public-ink)] transition-colors hover:text-[var(--public-pink)]"
          >
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-12 lg:gap-6">
          {featuredProjects.map((project, index) => {
            const isLead = index === 0;
            const placement =
              index === 0
                ? "lg:col-span-7 lg:row-span-2"
                : "lg:col-span-5";
            const price = project.priceDisplay ?? project.priceRange;

            return (
              <NextLink
                key={project._id}
                href={"/projects/" + project.slug.current}
                className={[
                  "group relative isolate min-h-[20rem] overflow-hidden bg-[var(--public-rose-paper)]",
                  placement,
                  isLead ? "lg:min-h-[38rem]" : "lg:min-h-[18.2rem]",
                ].join(" ")}
              >
                {project.imageUrl ? (
                  <Image
                    src={project.imageUrl}
                    alt={project.name[locale]}
                    fill
                    sizes={
                      isLead
                        ? "(max-width: 1024px) 100vw, 58vw"
                        : "(max-width: 1024px) 100vw, 42vw"
                    }
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,_var(--public-blush),_var(--public-paper))]" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,_transparent_32%,rgba(68,57,61,0.72)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/75">
                    {isLead ? t("featured") : t("project")}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-bold leading-tight sm:text-3xl">
                    {project.name[locale]}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
                    {price ? <span>{price}</span> : null}
                    {project.duration ? (
                      <span>
                        {t("duration")}: {project.duration}
                      </span>
                    ) : null}
                  </div>
                </div>
              </NextLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
