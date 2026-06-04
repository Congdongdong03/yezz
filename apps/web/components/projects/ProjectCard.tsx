"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "next-intl";

/** Tags may be stored as "中文|English" — pick the right side for locale. */
function localizeTag(tag: string, locale: string): string {
  const parts = tag.split("|");
  if (parts.length === 2) {
    return locale === "en" ? (parts[1]?.trim() || parts[0]) : (parts[0]?.trim() || tag);
  }
  return tag;
}

interface ProjectCardProps {
  project: {
    _id: string;
    name: { en: string; zh: string };
    slug?: { current: string };
    imageUrl?: string;
    priceRange?: string;
    priceDisplay?: string;
    duration?: string;
    tags?: string[];
  };
  locale: string;
}

export default function ProjectCard({ project, locale }: ProjectCardProps) {
  const currentLocale = useLocale();
  const slug = project.slug?.current;
  const href = slug ? `/${currentLocale}/projects/${slug}` : `/${currentLocale}/projects`;

  return (
    <Link
      href={href}
      className="group block cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {project.imageUrl ? (
          <Image
            src={project.imageUrl}
            alt={project.name[locale as "en" | "zh"]}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">
              {locale === "zh" ? "暂无图片" : "No image"}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-bold text-warm-charcoal">
          {project.name[locale as "en" | "zh"]}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {project.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-soft-pink/20 px-3 py-1 text-xs text-warm-charcoal"
            >
              {localizeTag(tag, locale)}
            </span>
          ))}
        </div>
        {(project.priceDisplay ?? project.priceRange) && (
          <p className="mt-2 text-sm text-caramel">
            {project.priceDisplay ?? project.priceRange}
          </p>
        )}
      </div>
    </Link>
  );
}
