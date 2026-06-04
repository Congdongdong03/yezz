"use client";

import { useTranslations } from "next-intl";

export default function ErrorFallback({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
        {t("boundaryTitle")}
      </h2>
      <p className="mt-2 text-warm-grey">{t("boundaryMessage")}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-full bg-caramel px-6 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          {t("boundaryRetry")}
        </button>
      )}
    </div>
  );
}
