import { loadPartiesPageData, loadSiteSettings } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import PartyInquiryCTA from "@/components/parties/PartyInquiryCTA";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "parties" });
  return buildPageMetadata({
    title: t("title"),
    description: t("subtitle"),
  });
}

export default async function PartiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("parties");
  const partiesResult = await loadPartiesPageData();
  const settings = await loadSiteSettings();

  if (!partiesResult.ok) {
    return <ServiceUnavailable />;
  }

  const parties = partiesResult.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-4 text-warm-grey">{t("subtitle")}</p>

      <div className="mt-12 space-y-12">
        {parties.map(
          (
            party: {
              _id: string;
              slug?: { current: string };
              imageUrl?: string;
              name: Record<string, string>;
              description?: Record<string, string>;
              includes?: Record<string, string>[];
              priceIndicator?: string;
            },
            index: number,
          ) => (
            <div
              key={party._id}
              id={party.slug?.current}
              className={`scroll-mt-24 flex flex-col gap-8 ${
                index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              }`}
            >
              <div className="relative aspect-video md:w-1/2">
                {party.imageUrl ? (
                  <Image
                    src={party.imageUrl}
                    alt={party.name[locale]}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl bg-muted">
                    <span>{locale === "zh" ? "暂无图片" : "No image"}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center md:w-1/2">
                <h2 className="text-2xl font-serif font-bold text-warm-charcoal">
                  {party.name[locale]}
                </h2>
                <p className="mt-4 text-warm-grey">{party.description?.[locale]}</p>
                <ul className="mt-4 space-y-2">
                  {party.includes?.map((item: Record<string, string>, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-sage">✓</span>
                      {item[locale]}
                    </li>
                  ))}
                </ul>
                {party.priceIndicator && (
                  <p className="mt-4 font-medium text-caramel">{party.priceIndicator}</p>
                )}
                <PartyInquiryCTA wechatId={settings.wechatId} />
              </div>
            </div>
          ),
        )}
      </div>

      <div className="mt-16 rounded-2xl bg-cream p-8 text-center md:p-12">
        <h2 className="font-serif text-2xl font-bold text-warm-charcoal md:text-3xl">
          {locale === "zh" ? "想定制专属派对？" : "Want a custom party?"}
        </h2>
        <p className="mt-3 text-warm-grey">
          {locale === "zh"
            ? "联系我们，我们可以根据您的需求定制完美的派对体验。"
            : "Contact us and we can tailor the perfect party experience for your needs."}
        </p>
        <PartyInquiryCTA wechatId={settings.wechatId} />
      </div>
    </div>
  );
}
