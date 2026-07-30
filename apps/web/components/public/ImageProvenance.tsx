import type { PublicLocale } from "@/lib/editorial/media";

type ImageProvenanceProps = {
  locale: PublicLocale;
  kind: "inspiration";
  sourceUrl: string;
  licenseUrl: string;
  className?: string;
};

const copy = {
  en: {
    label: "DIY inspiration",
    source: "Source",
    license: "License",
  },
  zh: {
    label: "DIY 灵感图",
    source: "来源",
    license: "许可",
  },
} as const;

export default function ImageProvenance({
  locale,
  kind,
  sourceUrl,
  licenseUrl,
  className,
}: ImageProvenanceProps) {
  const t = copy[locale];

  return (
    <p
      className={[
        "text-xs leading-5 text-[var(--public-muted)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="font-medium text-[var(--public-ink)]">
        {kind === "inspiration" ? t.label : null}
      </span>
      <span aria-hidden="true"> · </span>
      <a
        className="underline decoration-[var(--public-border)] underline-offset-4 hover:decoration-[var(--public-pink)]"
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        {t.source}
      </a>
      <span aria-hidden="true"> · </span>
      <a
        className="underline decoration-[var(--public-border)] underline-offset-4 hover:decoration-[var(--public-pink)]"
        href={licenseUrl}
        target="_blank"
        rel="noreferrer"
      >
        {t.license}
      </a>
    </p>
  );
}
