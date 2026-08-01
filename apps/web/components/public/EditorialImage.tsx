import Image from "next/image";
import type { EditorialMedia, PublicLocale } from "@/lib/editorial/media";
import ImageProvenance from "./ImageProvenance";

type CatalogueImageMedia = {
  kind: "inspiration" | "yezyy" | "placeholder";
  imageUrl: string;
  sourceUrl?: string | null;
  licenseUrl?: string | null;
  alt: Record<PublicLocale, string>;
};

type EditorialImageProps = {
  media: EditorialMedia | CatalogueImageMedia;
  locale: PublicLocale;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export default function EditorialImage({
  media,
  locale,
  sizes,
  className = "",
  priority = false,
}: EditorialImageProps) {
  return (
    <figure className={className}>
      <div className="relative h-full min-h-0 overflow-hidden">
        <Image
          src={media.imageUrl}
          alt={media.alt[locale]}
          fill
          sizes={sizes}
          className="object-cover"
          priority={priority}
        />
      </div>
      {media.kind === "inspiration" && media.sourceUrl && media.licenseUrl ? (
        <figcaption className="mt-3">
          <ImageProvenance locale={locale} kind="inspiration" sourceUrl={media.sourceUrl} licenseUrl={media.licenseUrl} />
        </figcaption>
      ) : null}
    </figure>
  );
}
