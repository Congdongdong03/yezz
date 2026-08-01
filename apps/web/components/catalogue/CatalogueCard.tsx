import Link from "next/link";
import Image from "next/image";
import type { CatalogueEntryView } from "@/lib/catalogue/data";
import ImageProvenance from "@/components/public/ImageProvenance";

type CatalogueCardProps = {
  entry: CatalogueEntryView;
  locale: string;
};

export default function CatalogueCard({ entry, locale }: CatalogueCardProps) {
  const language = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const hasInspirationImage =
    entry.image?.kind === "inspiration" &&
    Boolean(entry.image.sourceUrl) &&
    Boolean(entry.image.licenseUrl);

  return (
    <article className="public-project-card group overflow-hidden rounded-[1.5rem] bg-white">
      <Link href={`/${locale}/projects/${entry.slug.current}`} className="block">
        <div className="relative aspect-[5/4] overflow-hidden bg-[var(--public-blush)]">
          {entry.imageUrl ? (
            <Image
              src={entry.imageUrl}
              alt={entry.name[language]}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-end p-6">
              <span className="font-serif text-3xl text-[var(--public-pink)]/70">YezYY</span>
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-serif text-2xl leading-tight text-[var(--public-ink)]">{entry.name[language]}</h3>
            {entry.priceDisplay ? <p className="shrink-0 text-sm font-semibold text-[var(--public-pink)]">{entry.priceDisplay}</p> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">{entry.durationDisplay[language]}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.occasionTags.slice(0, 3).map((tag) => (
              <span key={tag.en} className="rounded-full bg-[var(--public-blush)] px-3 py-1 text-xs text-[var(--public-ink)]">
                {tag[language]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--public-muted)]">{entry.availabilityNote[language]}</p>
        </div>
      </Link>
      {hasInspirationImage ? (
        <div className="border-t border-[var(--public-border)] px-5 py-3 sm:px-6">
          <ImageProvenance
            locale={language}
            kind="inspiration"
            sourceUrl={entry.image.sourceUrl!}
            licenseUrl={entry.image.licenseUrl!}
          />
        </div>
      ) : null}
    </article>
  );
}
