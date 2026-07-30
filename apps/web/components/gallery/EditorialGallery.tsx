import Image from "next/image";
import EditorialImage from "@/components/public/EditorialImage";
import { EDITORIAL_MEDIA, type PublicLocale } from "@/lib/editorial/media";

type GalleryImage = {
  _id: string;
  imageUrl?: string;
  category?: string;
  caption?: { en?: string; zh?: string };
};

type EditorialGalleryProps = {
  locale: PublicLocale;
  images: GalleryImage[];
};

const copy = {
  en: {
    atStudio: "At YezYY",
    atStudioBody: "A few real glimpses of our Glen Waverley studio.",
    inspiration: "DIY inspiration",
    inspirationBody: "Ideas and materials that help us imagine what you might make next.",
    community: "Community moments",
    communityBody: "Customer moments will appear here once we have permission to share them.",
    noStudioImage: "Studio photos are being curated.",
  },
  zh: {
    atStudio: "YezYY 店内",
    atStudioBody: "来自 Glen Waverley 实体店的一些真实画面。",
    inspiration: "DIY 灵感图",
    inspirationBody: "从材料和制作灵感里，想象下一次可以完成什么。",
    community: "社区时刻",
    communityBody: "取得分享许可后的顾客作品和活动照片会在这里出现。",
    noStudioImage: "门店照片正在整理中。",
  },
} as const;

export default function EditorialGallery({
  locale,
  images,
}: EditorialGalleryProps) {
  const t = copy[locale];
  const storeImages = images.filter(
    (image) => image.category === "store" && image.imageUrl,
  );

  return (
    <div className="space-y-20 sm:space-y-28">
      <section>
        <div className="max-w-2xl">
          <p className="public-eyebrow">{t.atStudio}</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-[var(--public-ink)] sm:text-4xl">
            {t.atStudio}
          </h2>
          <p className="mt-4 leading-7 text-[var(--public-muted)]">{t.atStudioBody}</p>
        </div>
        {storeImages.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
            {storeImages.map((image, index) => (
              <div
                key={image._id}
                className={[
                  "relative min-h-[18rem] overflow-hidden bg-[var(--public-rose-paper)]",
                  index === 0 ? "sm:col-span-2 lg:col-span-7 lg:min-h-[34rem]" : "lg:col-span-5",
                ].join(" ")}
              >
                <Image
                  src={image.imageUrl!}
                  alt={image.caption?.[locale] ?? image.caption?.en ?? "YezYY studio"}
                  fill
                  sizes={
                    index === 0
                      ? "(max-width: 1024px) 100vw, 58vw"
                      : "(max-width: 1024px) 50vw, 42vw"
                  }
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-[var(--public-border)] bg-[var(--public-paper)] px-6 py-14 text-[var(--public-muted)]">
            {t.noStudioImage}
          </div>
        )}
      </section>

      <section className="border-y border-[var(--public-border)] py-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="public-eyebrow">{t.inspiration}</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-[var(--public-ink)] sm:text-4xl">
            {t.inspiration}
          </h2>
          <p className="mt-4 leading-7 text-[var(--public-muted)]">{t.inspirationBody}</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {EDITORIAL_MEDIA.map((media, index) => (
            <EditorialImage
              key={media.id}
              media={media}
              locale={locale}
              sizes="(max-width: 640px) 100vw, 33vw"
              className={index === 1 ? "sm:mt-10" : ""}
            />
          ))}
        </div>
      </section>

      <section className="max-w-2xl">
        <p className="public-eyebrow">{t.community}</p>
        <h2 className="mt-3 font-serif text-3xl font-bold text-[var(--public-ink)] sm:text-4xl">
          {t.community}
        </h2>
        <p className="mt-4 leading-7 text-[var(--public-muted)]">{t.communityBody}</p>
      </section>
    </div>
  );
}
