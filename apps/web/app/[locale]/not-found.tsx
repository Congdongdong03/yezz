import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-8xl font-bold text-caramel opacity-30">404</p>
      <h1 className="mt-4 font-serif text-2xl font-bold text-warm-charcoal md:text-3xl">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-3 max-w-sm text-warm-grey">{t("notFoundMessage")}</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-caramel px-8 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
      >
        {t("notFoundBack")}
      </Link>
    </div>
  );
}
