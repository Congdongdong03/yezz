import Image from "next/image";
import EditorialImage from "@/components/public/EditorialImage";
import { EDITORIAL_MEDIA, type PublicLocale } from "@/lib/editorial/media";
import { selectStudioMedia } from "@/lib/site/studio-media";

type GalleryImage = {
  _id: string;
  imageUrl?: string;
  category?: string;
  order?: number;
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
    process: "See how it comes together",
    processBody: "Choose a base, pick your materials, and make it your own at the studio.",
    processEmpty: "Making photos are coming soon. The studio is open and every session is guided in person.",
    parties: "A party made by hand",
    partiesBody: "A small creative celebration for 4–8 DIY participants.",
    partiesEmpty: "Party photos are coming soon. Current packages can still be requested online.",
    inspiration: "DIY inspiration",
    inspirationBody: "Reference ideas only—not photographs of finished YezYY customer projects.",
    community: "Community moments",
    communityBody: "Customer moments will appear here once we have permission to share them.",
    noStudioImage: "Studio photos are being curated.",
    studioAlt: "YezYY studio",
    processAlt: "DIY making at YezYY",
    partyAlt: "DIY party at YezYY",
    communityAlt: "YezYY customer creation shared with permission",
  },
  zh: {
    atStudio: "YezYY 店内",
    atStudioBody: "来自 Glen Waverley 实体店的一些真实画面。",
    process: "看看作品如何完成",
    processBody: "选择底材和装饰材料，在店内工作人员协助下完成自己的作品。",
    processEmpty: "制作过程照片即将补充。门店已营业，每次体验均可获得现场协助。",
    parties: "亲手完成的派对",
    partiesBody: "适合 4 至 8 位手作参与者的小型创意庆祝活动。",
    partiesEmpty: "派对照片即将补充，目前仍可在线提交派对申请。",
    inspiration: "DIY 灵感参考",
    inspirationBody: "这些仅为灵感参考，并非 YezYY 顾客完成作品的照片。",
    community: "社区时刻",
    communityBody: "取得分享许可后的顾客作品和活动照片会在这里出现。",
    noStudioImage: "门店照片正在整理中。",
    studioAlt: "YezYY 门店",
    processAlt: "YezYY 店内手作过程",
    partyAlt: "YezYY 手作派对",
    communityAlt: "经授权分享的 YezYY 顾客作品",
  },
} as const;

function SectionHeading({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="public-eyebrow">{title}</p>
      <h2 className="mt-3 font-serif text-3xl font-bold text-[var(--public-ink)] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 leading-7 text-[var(--public-muted)]">{body}</p>
    </div>
  );
}

function RealMediaGrid({
  alt,
  images,
  locale,
  prominent = false,
}: {
  alt: string;
  images: GalleryImage[];
  locale: PublicLocale;
  prominent?: boolean;
}) {
  return (
    <div className={`mt-8 grid gap-4 sm:grid-cols-2 ${prominent ? "lg:grid-cols-12 lg:gap-6" : "lg:grid-cols-3"}`}>
      {images.map((image, index) => (
        <figure
          key={image._id}
          className={
            prominent && index === 0 ? "sm:col-span-2 lg:col-span-7" : prominent ? "lg:col-span-5" : ""
          }
        >
          <div
            className={`relative overflow-hidden bg-[var(--public-rose-paper)] ${
              prominent && index === 0 ? "min-h-[24rem] lg:min-h-[34rem]" : "min-h-[20rem]"
            }`}
          >
            <Image
              src={image.imageUrl!}
              alt={image.caption?.[locale] ?? image.caption?.en ?? alt}
              fill
              sizes={prominent ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 640px) 100vw, 33vw"}
              className="object-cover"
            />
          </div>
          {image.caption?.[locale] || image.caption?.en ? (
            <figcaption className="mt-3 text-sm leading-6 text-[var(--public-muted)]">
              {image.caption?.[locale] ?? image.caption?.en}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

function EmptyMediaNote({ children }: { children: string }) {
  return (
    <p className="mt-8 border border-dashed border-[var(--public-border)] bg-[var(--public-paper)] px-6 py-10 leading-7 text-[var(--public-muted)]">
      {children}
    </p>
  );
}

export default function EditorialGallery({
  locale,
  images,
}: EditorialGalleryProps) {
  const t = copy[locale];
  const selected = selectStudioMedia(images);
  const atStudio = [
    ...selected.store,
    ...(selected.arrival && !selected.store.some((image) => image._id === selected.arrival?._id)
      ? [selected.arrival]
      : []),
  ];

  return (
    <div className="space-y-20 sm:space-y-28">
      <section>
        <SectionHeading title={t.atStudio} body={t.atStudioBody} />
        {atStudio.length ? (
          <RealMediaGrid images={atStudio} locale={locale} alt={t.studioAlt} prominent />
        ) : (
          <EmptyMediaNote>{t.noStudioImage}</EmptyMediaNote>
        )}
      </section>

      <section className="grid gap-12 border-y border-[var(--public-border)] py-12 lg:grid-cols-2 lg:gap-8 sm:py-16">
        <div>
          <SectionHeading title={t.process} body={t.processBody} />
          {selected.process.length ? (
            <RealMediaGrid images={selected.process} locale={locale} alt={t.processAlt} />
          ) : (
            <EmptyMediaNote>{t.processEmpty}</EmptyMediaNote>
          )}
        </div>
        <div>
          <SectionHeading title={t.parties} body={t.partiesBody} />
          {selected.party.length ? (
            <RealMediaGrid images={selected.party} locale={locale} alt={t.partyAlt} />
          ) : (
            <EmptyMediaNote>{t.partiesEmpty}</EmptyMediaNote>
          )}
        </div>
      </section>

      <section>
        <SectionHeading title={t.community} body={t.communityBody} />
        {selected.community.length ? (
          <RealMediaGrid images={selected.community} locale={locale} alt={t.communityAlt} />
        ) : null}
      </section>

      <section className="bg-[var(--public-rose-paper)] px-5 py-10 sm:px-10 sm:py-14">
        <SectionHeading title={t.inspiration} body={t.inspirationBody} />
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
    </div>
  );
}
