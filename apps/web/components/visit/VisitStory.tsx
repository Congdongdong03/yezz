import Image from "next/image";
import {
  formatBusinessHours,
  formatPhoneHref,
  YEZYY_BUSINESS_PROFILE,
} from "@/lib/site/business";
import { toGoogleMapsEmbedUrl } from "@/lib/site/maps";
import type { SiteSettingsView } from "@/lib/site/data";
import type { PublicLocale } from "@/lib/editorial/media";

type StoreImage = {
  _id: string;
  imageUrl?: string;
  caption?: { en?: string; zh?: string };
} | null;

type VisitStoryProps = {
  locale: PublicLocale;
  settings: SiteSettingsView | null;
  storeImage: StoreImage;
};

const copy = {
  en: {
    eyebrow: "Visit YezYY",
    title: "A real studio in Glen Waverley",
    intro: "Come in, choose a project, and take your time making something personal.",
    address: "Studio address",
    hours: "Opening hours",
    contact: "Talk to the studio",
    map: "Find us",
    mapAction: "Open in Google Maps",
    xiaohongshu: "Xiaohongshu",
  },
  zh: {
    eyebrow: "到访 YezYY",
    title: "位于 Glen Waverley 的实体手作空间",
    intro: "来到店里，选择一个项目，慢慢完成属于自己的作品。",
    address: "门店地址",
    hours: "营业时间",
    contact: "联系门店",
    map: "找到我们",
    mapAction: "在 Google 地图中查看",
    xiaohongshu: "小红书",
  },
} as const;

export default function VisitStory({
  locale,
  settings,
  storeImage,
}: VisitStoryProps) {
  const t = copy[locale];
  const hours = formatBusinessHours(locale);
  const phone = settings?.phone ?? YEZYY_BUSINESS_PROFILE.phone;
  const email = settings?.email ?? YEZYY_BUSINESS_PROFILE.email;
  const mapUrl = settings?.googleMapUrl ?? YEZYY_BUSINESS_PROFILE.googleMapUrl;

  return (
    <div className="space-y-10 sm:space-y-16">
      <section className="grid overflow-hidden border border-[var(--public-border)] lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative min-h-[22rem] bg-[var(--public-rose-paper)]">
          {storeImage?.imageUrl ? (
            <Image
              src={storeImage.imageUrl}
              alt={storeImage.caption?.[locale] ?? storeImage.caption?.en ?? "YezYY studio"}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center font-serif text-2xl text-[var(--public-muted)]">
              YezYY
            </div>
          )}
        </div>
        <div className="flex flex-col justify-end p-7 sm:p-12">
          <p className="public-eyebrow">{t.eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[var(--public-ink)] sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-6 leading-8 text-[var(--public-muted)]">{t.intro}</p>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden border border-[var(--public-border)] bg-[var(--public-border)] sm:grid-cols-2">
        <div className="bg-[var(--public-paper)] p-6 sm:p-8">
          <h2 className="font-medium text-[var(--public-ink)]">{t.address}</h2>
          <p className="mt-3 max-w-md leading-7 text-[var(--public-muted)]">
            {settings?.address ?? YEZYY_BUSINESS_PROFILE.address}
          </p>
        </div>
        <div className="bg-[var(--public-paper)] p-6 sm:p-8">
          <h2 className="font-medium text-[var(--public-ink)]">{t.hours}</h2>
          <p className="mt-3 max-w-md leading-7 text-[var(--public-muted)]">{hours}</p>
        </div>
        <div className="bg-[var(--public-paper)] p-6 sm:p-8">
          <h2 className="font-medium text-[var(--public-ink)]">{t.contact}</h2>
          <a
            className="mt-3 block w-fit text-[var(--public-pink)] underline underline-offset-4"
            href={"tel:" + formatPhoneHref(phone)}
          >
            {phone}
          </a>
          <a
            className="mt-2 block w-fit text-[var(--public-pink)] underline underline-offset-4"
            href={"mailto:" + email}
          >
            {email}
          </a>
          <p className="mt-3 text-sm text-[var(--public-muted)]">
            {t.xiaohongshu}: {settings?.xiaohongshu ?? YEZYY_BUSINESS_PROFILE.xiaohongshu}
          </p>
        </div>
        <div className="bg-[var(--public-paper)] p-6 sm:p-8">
          <h2 className="font-medium text-[var(--public-ink)]">{t.map}</h2>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-full border border-[var(--public-pink)] px-4 py-2 text-sm font-medium text-[var(--public-ink)] transition-colors hover:bg-[var(--public-blush)]"
          >
            {t.mapAction}
          </a>
        </div>
      </section>

      <section className="overflow-hidden border border-[var(--public-border)] bg-[var(--public-paper)] p-4 sm:p-6">
        <iframe
          title={t.map}
          src={toGoogleMapsEmbedUrl(mapUrl)}
          className="h-80 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </section>
    </div>
  );
}
