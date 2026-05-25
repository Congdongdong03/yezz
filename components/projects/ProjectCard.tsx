"use client";

import Image from "next/image";
import { useLocale } from "next-intl";

interface ProjectCardProps {
  project: {
    _id: string;
    name: { en: string; zh: string };
    slug?: { current: string };
    imageUrl?: string;
    priceRange?: string;
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
    <a
      href={href}
      className="group block cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {project.imageUrl ? (
          <Image
            src={project.imageUrl}
            alt={project.name[locale as "en" | "zh"]}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">No image</span>
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
              {tag}
            </span>
          ))}
        </div>
        {project.priceRange && (
          <p className="mt-2 text-sm text-caramel">{project.priceRange}</p>
        )}
      </div>
    </a>
  );
}
