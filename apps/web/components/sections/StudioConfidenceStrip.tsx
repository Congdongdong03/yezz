"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

const factKeys = ["beginner", "included", "confirmation", "payment"] as const;

export default function StudioConfidenceStrip() {
  const t = useTranslations("home.studioConfidence");

  return (
    <section
      aria-label={t("label")}
      className="border-y border-[var(--public-border)] bg-[var(--public-paper)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <ul className="grid gap-3 text-sm text-[var(--public-ink)] sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {factKeys.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <Check
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[var(--public-pink)]"
              />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
