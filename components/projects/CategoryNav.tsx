"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import {
  Palette,
  Gem,
  Box,
  Sparkles,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  palette: Palette,
  gem: Gem,
  box: Box,
  "party-popper": PartyPopper,
  sparkles: Sparkles,
};

interface Category {
  slug: { current: string };
  name: { en: string; zh: string };
  icon?: string;
}

interface CategoryNavProps {
  categories: Category[];
}

export default function CategoryNav({ categories }: CategoryNavProps) {
  const locale = useLocale();
  const [activeSlug, setActiveSlug] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    categories.forEach((cat) => {
      const el = document.getElementById(cat.slug.current);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories]);

  const scrollTo = (slug: string) => {
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="sticky top-16 z-30 border-b border-warm-grey/10 bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const Icon = cat.icon ? iconMap[cat.icon] : null;
            const isActive = activeSlug === cat.slug.current;
            return (
              <button
                key={cat.slug.current}
                onClick={() => scrollTo(cat.slug.current)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-caramel text-white"
                    : "bg-white text-warm-charcoal hover:bg-caramel/10"
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {cat.name[locale as "en" | "zh"]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
