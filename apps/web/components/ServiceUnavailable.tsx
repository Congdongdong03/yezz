import { getTranslations } from "next-intl/server";

export default async function ServiceUnavailable() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
        {t("unavailableTitle")}
      </h2>
      <p className="mt-2 max-w-md text-warm-grey">{t("unavailableMessage")}</p>
    </div>
  );
}
