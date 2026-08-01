import type { CatalogueEntryView } from "@/lib/catalogue/data";
import CatalogueCard from "./CatalogueCard";

type CatalogueSectionProps = {
  category: CatalogueEntryView["category"];
  entries: CatalogueEntryView[];
  locale: string;
};

export default function CatalogueSection({ category, entries, locale }: CatalogueSectionProps) {
  const language = locale.toLowerCase().startsWith("zh") ? "zh" : "en";

  return (
    <section id={category.slug.current} className="scroll-mt-28 px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <header className="mb-9 max-w-2xl">
          <p className="public-eyebrow">{language === "zh" ? "YezYY 手作" : "YezYY DIY"}</p>
          <h2 className="mt-3 font-serif text-4xl text-[var(--public-ink)] sm:text-5xl">{category.name[language]}</h2>
        </header>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => <CatalogueCard key={entry._id} entry={entry} locale={locale} />)}
        </div>
      </div>
    </section>
  );
}
