"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/routing";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-8xl font-bold text-caramel opacity-30">!</p>
      <h1 className="mt-4 font-serif text-2xl font-bold text-warm-charcoal md:text-3xl">
        {t("errorTitle")}
      </h1>
      <p className="mt-3 max-w-sm text-warm-grey">{t("errorMessage")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-caramel px-8 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          {t("errorRetry")}
        </button>
        <Link
          href="/"
          className="rounded-full border border-warm-grey/30 px-8 py-3 text-sm font-medium text-warm-charcoal transition-transform hover:-translate-y-0.5"
        >
          {t("errorBack")}
        </Link>
      </div>
    </div>
  );
}
