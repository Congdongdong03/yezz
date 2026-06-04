"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";

export default function BookNavButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  const onProjectDetail = Boolean(projectMatch);

  if (onProjectDetail) {
    return (
      <button
        type="button"
        onClick={() => {
          const el = document.getElementById("booking-form");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          router.push("/cart");
        }}
        className={className}
      >
        {t("book")}
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {t("book")}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-cream p-6 shadow-xl">
            <h2
              id="book-guide-title"
              className="font-serif text-lg font-bold text-warm-charcoal"
            >
              {t("bookGuideTitle")}
            </h2>
            <p className="mt-2 text-sm text-warm-grey">{t("bookGuideBody")}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/projects"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-caramel py-2.5 text-center text-sm font-medium text-white"
              >
                {t("bookGuideProjects")}
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-warm-grey/30 py-2.5 text-sm text-warm-charcoal"
              >
                {t("bookGuideClose")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
