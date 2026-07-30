"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart/context";
import { Link } from "@/i18n/routing";
import StyleSelector from "./StyleSelector";
import { trackViewProject } from "@/lib/analytics/gtag";
import RequestContactFallback from "@/components/RequestContactFallback";

function localizeTag(tag: string, locale: string): string {
  const parts = tag.split("|");
  if (parts.length === 2) {
    return locale === "en" ? (parts[1]?.trim() || parts[0]) : (parts[0]?.trim() || tag);
  }
  return tag;
}

function localizeDuration(duration: string, locale: string): string {
  const parts = duration.split("|");
  if (parts.length === 2) {
    return locale === "en" ? (parts[1]?.trim() || parts[0]) : (parts[0]?.trim() || duration);
  }
  return duration;
}

interface ProjectDetailProps {
  project: {
    _id: string;
    name: { en: string; zh: string };
    slug?: { current: string };
    projectType?: string;
    description?: { en: string; zh: string };
    imageUrl?: string;
    images?: string[];
    styles?: Array<{
      _id: string;
      name: { en: string; zh: string };
      price?: string;
      priceDisplay?: string;
      imageUrl?: string;
    }>;
    priceRange?: string;
    priceDisplay?: string;
    duration?: string;
    tags?: string[];
    category?: { _id: string };
  };
  locale: string;
  requestEnabled: boolean;
}

export default function ProjectDetail({
  project,
  locale: _locale,
  requestEnabled,
}: ProjectDetailProps) {
  void _locale;
  const pageLocale = useLocale();
  const t = useTranslations("projectDetail");
  const cartT = useTranslations("cart");
  const { addItem, setIsOpen } = useCart();

  type ProjectStyle = NonNullable<ProjectDetailProps["project"]["styles"]>[number];
  const [selectedStyle, setSelectedStyle] = useState<ProjectStyle | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    trackViewProject({
      project_slug: project.slug?.current ?? project._id,
      project_name: project.name.en,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project._id]);

  const isProduct = project.projectType === "product";
  const projectLabel = project.name[pageLocale as "en" | "zh"];
  const displayPrice = project.priceDisplay ?? project.priceRange;

  const handleAddToCart = () => {
    if (!isProduct || !selectedStyle) return;
    const item = {
      projectId: project._id,
      projectSlug: project.slug?.current ?? "",
      projectName: project.name,
      projectType: "product" as const,
      imageUrl: project.imageUrl,
      styleId: selectedStyle._id,
      styleName: selectedStyle.name,
      price: selectedStyle.priceDisplay ?? selectedStyle.price,
    };
    const didAdd = addItem(item);
    if (didAdd) {
      setAdded(true);
      setIsOpen(true);
      setTimeout(() => setAdded(false), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-cream pb-20">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 md:pt-14">
        <Link
          href="/projects"
          className="inline-flex rounded-full border border-[var(--public-border)] bg-white px-4 py-2 text-sm text-warm-grey transition-colors hover:text-caramel"
        >
          ← {t("back")}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-7"
        >
          <div className="grid gap-3 sm:grid-cols-12 sm:gap-4">
            {project.images?.map((img: string, i: number) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-[1.5rem] border border-[var(--public-border)] ${i === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-square"}`}
              >
                <Image src={img} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 896px) 50vw, 450px" className="object-cover" />
              </div>
            ))}
          </div>

          <div className="mt-7 grid border-y border-[var(--public-border)] bg-white lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="p-6 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel">
                YezYY DIY Studio
              </p>
            <h1 className="font-serif text-3xl font-bold text-warm-charcoal sm:text-4xl">
              {projectLabel}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--public-blush)] px-3 py-1 text-xs text-warm-charcoal"
                >
                  {localizeTag(tag, pageLocale)}
                </span>
              ))}
            </div>
            {project.description && (
              <p className="mt-6 max-w-2xl leading-relaxed text-warm-charcoal">
                {project.description[pageLocale as "en" | "zh"]}
              </p>
            )}
            {!requestEnabled && (
              <div className="mt-8">
                <RequestContactFallback locale={pageLocale} />
              </div>
            )}

            {requestEnabled && isProduct && project.styles && (
              <>
              <StyleSelector
                styles={project.styles}
                selected={selectedStyle}
                onSelect={setSelectedStyle}
              />
              <div className="mt-8 flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedStyle}
                  className="flex-1 rounded-full border-2 border-caramel py-3 text-sm font-medium text-caramel transition-colors hover:bg-caramel/5 disabled:opacity-40"
                >
                  {added ? cartT("added") : cartT("add")}
                </button>
                <Link
                  href="/cart"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-full bg-caramel py-3 text-center text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {cartT("goToCart")}
                </Link>
              </div>
              </>
            )}

            {requestEnabled && !isProduct && (
              <section className="mt-10 rounded-2xl border border-[var(--public-border)] bg-[var(--public-blush)] p-6 sm:p-8">
                <h2 className="font-serif text-xl font-bold text-warm-charcoal">
                  {t("bookSectionTitle")}
                </h2>
                <p className="mt-1 text-sm text-warm-grey">{t("bookSectionHint")}</p>
                <Link
                  href="/book"
                  className="mt-6 inline-flex rounded-full bg-caramel px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {t("bookCurrentFlow")}
                </Link>
              </section>
            )}
            </div>

            {(displayPrice || project.duration) && (
              <dl
                data-testid="project-fact-rail"
                className="border-t border-[var(--public-border)] bg-[var(--public-rose-paper)] px-6 py-7 lg:border-l lg:border-t-0 sm:px-8"
              >
                {displayPrice && (
                  <div className="border-b border-[var(--public-border)] pb-5">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-grey">
                      {t("price")}
                    </dt>
                    <dd className="mt-2 font-serif text-2xl text-caramel">{displayPrice}</dd>
                  </div>
                )}
                {project.duration && (
                  <div className={displayPrice ? "pt-5" : ""}>
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-grey">
                      {t("duration")}
                    </dt>
                    <dd className="mt-2 text-lg text-warm-charcoal">
                      {localizeDuration(project.duration, pageLocale)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
