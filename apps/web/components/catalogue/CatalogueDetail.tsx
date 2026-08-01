import Image from "next/image";
import Link from "next/link";
import type { CatalogueEntryView } from "@/lib/catalogue/data";
import ImageProvenance from "@/components/public/ImageProvenance";
import RequestContactFallback from "@/components/RequestContactFallback";

type CatalogueDetailProps = {
  entry: CatalogueEntryView;
  locale: string;
  requestEnabled: boolean;
};

function formatExtraTime(priceCents: number, minutes: number, language: "en" | "zh") {
  const price = `A$${(priceCents / 100).toFixed(2)}`;
  return language === "zh" ? `加时 ${minutes} 分钟 · ${price}` : `${price} / ${minutes} min`;
}

export default function CatalogueDetail({ entry, locale, requestEnabled }: CatalogueDetailProps) {
  const language = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const hasInspirationImage = entry.image?.kind === "inspiration" && entry.image.sourceUrl && entry.image.licenseUrl;
  const categoryName = entry.category?.name?.[language] ?? "YezYY DIY";

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] px-4 py-10 sm:px-6 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Link href={`/${locale}/projects`} className="text-sm font-medium text-[var(--public-muted)] transition hover:text-[var(--public-pink)]">
          ← {language === "zh" ? "所有手作项目" : "All DIY projects"}
        </Link>
        <div className="mt-7 overflow-hidden rounded-[2rem] border border-[var(--public-border)] bg-white shadow-[0_22px_54px_rgba(68,57,61,0.07)] lg:grid lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            {entry.imageUrl ? (
              <figure>
                <div className="relative aspect-[16/9] overflow-hidden bg-[var(--public-blush)]">
                  <Image src={entry.imageUrl} alt={entry.name[language]} fill priority sizes="(max-width: 1024px) 100vw, 70vw" className="object-cover" />
                </div>
                {hasInspirationImage ? (
                  <figcaption className="border-b border-[var(--public-border)] px-6 py-3">
                    <ImageProvenance locale={language} kind="inspiration" sourceUrl={entry.image.sourceUrl!} licenseUrl={entry.image.licenseUrl!} />
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
            <div className="p-6 sm:p-9">
              <p className="public-eyebrow">{categoryName}</p>
              <h1 className="mt-3 font-serif text-4xl leading-tight text-[var(--public-ink)] sm:text-5xl">{entry.name[language]}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--public-muted)]">{entry.description[language]}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {entry.occasionTags.map((tag) => <span key={tag.en} className="rounded-full bg-[var(--public-blush)] px-3 py-1 text-xs text-[var(--public-ink)]">{tag[language]}</span>)}
              </div>
              <section className="mt-10 border-t border-[var(--public-border)] pt-8">
                <h2 className="font-serif text-2xl text-[var(--public-ink)]">{language === "zh" ? "到店选择尺寸或款式" : "Choose your size or style in store"}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{language === "zh" ? "颜色、材料和可选底坯会随门店库存变化。" : "Colours, materials and available bases can vary in store."}</p>
                <ul className="mt-5 divide-y divide-[var(--public-border)] border-y border-[var(--public-border)]">
                  {entry.variants.map((variant) => (
                    <li key={variant.projectId} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-4">
                      <div>
                        <p className="font-medium text-[var(--public-ink)]">{variant.name[language]}</p>
                        {variant.label ? <p className="mt-1 text-sm text-[var(--public-muted)]">{variant.label[language]}</p> : null}
                        {variant.extraTimeMinutes && variant.extraTimePriceCents ? <p className="mt-1 text-sm text-[var(--public-muted)]">{formatExtraTime(variant.extraTimePriceCents, variant.extraTimeMinutes, language)}</p> : null}
                      </div>
                      {variant.priceDisplay ? <p className="text-sm font-semibold text-[var(--public-pink)]">{variant.priceDisplay}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
              {!requestEnabled ? <div className="mt-10"><RequestContactFallback locale={locale} /></div> : null}
            </div>
          </div>
          <aside className="bg-[var(--public-rose-paper)] px-6 py-8 sm:px-9 lg:px-7" data-testid="catalogue-fact-rail">
            <dl className="space-y-6">
              <div className="border-b border-[var(--public-border)] pb-6"><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-muted)]">{language === "zh" ? "价格" : "Price"}</dt><dd className="mt-2 font-serif text-2xl text-[var(--public-pink)]">{entry.priceDisplay}</dd></div>
              <div className="border-b border-[var(--public-border)] pb-6"><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-muted)]">{language === "zh" ? "所需时间" : "Time"}</dt><dd className="mt-2 text-lg text-[var(--public-ink)]">{entry.durationDisplay[language]}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-muted)]">{language === "zh" ? "付款方式" : "Payment"}</dt><dd className="mt-2 text-sm leading-6 text-[var(--public-ink)]">{language === "zh" ? "澳币 · 到店付款" : "AUD · Pay in store"}</dd></div>
            </dl>
            <p className="mt-8 text-xs leading-5 text-[var(--public-muted)]">{entry.availabilityNote[language]}</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
