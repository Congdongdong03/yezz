import Link from "next/link";
import type { CatalogueEntryView } from "@/lib/catalogue/data";

type CatalogueCategoryGridProps = {
  entries: CatalogueEntryView[];
  locale: string;
};

const intro = {
  en: "Four ways to make something personal, from a quick little treat to a slower studio session.",
  zh: "四种不同的手作方式：从轻松的小作品，到可以慢慢完成的工作室体验。",
} as const;

export default function CatalogueCategoryGrid({
  entries,
  locale,
}: CatalogueCategoryGridProps) {
  const language = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const categories = Array.from(
    new Map(entries.map((entry) => [entry.category.slug.current, entry.category])).values(),
  ).sort((a, b) => a.order - b.order || a.slug.current.localeCompare(b.slug.current));

  return (
    <section className="public-section border-y border-[var(--public-border)] bg-[var(--public-rose-paper)] px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="public-eyebrow">{language === "zh" ? "手作项目" : "DIY projects"}</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[var(--public-ink)] sm:text-4xl">
            {language === "zh" ? "选一种方式，把时间留给自己。" : "Choose a way to make time for yourself."}
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--public-muted)]">{intro[language]}</p>
        </div>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.slug.current}
              href={`/${locale}/projects#${category.slug.current}`}
              className="group rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-[0_15px_36px_rgba(68,57,61,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(68,57,61,0.14)]"
            >
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--public-pink)]">0{index + 1}</p>
              <h3 className="mt-8 font-serif text-2xl text-[var(--public-ink)]">{category.name[language]}</h3>
              <span className="mt-5 inline-flex text-sm font-medium text-[var(--public-muted)] transition group-hover:text-[var(--public-pink)]">
                {language === "zh" ? "查看项目 →" : "View projects →"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
