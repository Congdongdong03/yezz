import { loadPartiesPageData, loadSiteSettings } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import PartyInquiryCTA from "@/components/parties/PartyInquiryCTA";
import RequestContactFallback from "@/components/RequestContactFallback";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { Metadata } from "next";
import {
  YEZYY_BUSINESS_PROFILE,
  formatPhoneHref,
} from "@/lib/site/business";

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
    locale,
    pathname: "/parties",
  });
}

type PartiesLoadResult = Awaited<ReturnType<typeof loadPartiesPageData>>;
type LiveParty = Extract<PartiesLoadResult, { ok: true }>["data"][number];

type PartyCard = {
  id?: string;
  imageUrl?: string;
  name: { en: string; zh: string };
  guestDurationMinutes: 90 | 150;
  setupMinutes: 30;
  cleanupMinutes: 30;
  venueFeeCents: 9500 | 14500;
  minPeople: 4;
  maxPeople: 8;
  minSpendPerPersonCents: 4500;
  minParents: 1;
  maxParents: 2;
};

const FALLBACK_PACKAGES: PartyCard[] = [
  {
    name: { en: "Standard", zh: "标准套餐" },
    guestDurationMinutes: 90,
    setupMinutes: 30,
    cleanupMinutes: 30,
    venueFeeCents: 9500,
    minPeople: 4,
    maxPeople: 8,
    minSpendPerPersonCents: 4500,
    minParents: 1,
    maxParents: 2,
  },
  {
    name: { en: "Extended", zh: "延长套餐" },
    guestDurationMinutes: 150,
    setupMinutes: 30,
    cleanupMinutes: 30,
    venueFeeCents: 14500,
    minPeople: 4,
    maxPeople: 8,
    minSpendPerPersonCents: 4500,
    minParents: 1,
    maxParents: 2,
  },
];

function toVerifiedPartyCard(party: LiveParty): PartyCard | null {
  const duration = party.guestDurationMinutes;
  const fee = party.venueFeeCents;
  if (
    (duration !== 90 && duration !== 150) ||
    (fee !== 9500 && fee !== 14500) ||
    (duration === 90 && fee !== 9500) ||
    (duration === 150 && fee !== 14500) ||
    party.setupMinutes !== 30 ||
    party.cleanupMinutes !== 30 ||
    party.minPeople !== 4 ||
    party.maxPeople !== 8 ||
    party.minSpendPerPersonCents !== 4500 ||
    party.minParents !== 1 ||
    party.maxParents !== 2
  ) {
    return null;
  }
  return {
    id: party._id,
    imageUrl: party.imageUrl,
    name: party.name,
    guestDurationMinutes: duration,
    setupMinutes: 30,
    cleanupMinutes: 30,
    venueFeeCents: fee,
    minPeople: 4,
    maxPeople: 8,
    minSpendPerPersonCents: 4500,
    minParents: 1,
    maxParents: 2,
  };
}

function formatHours(minutes: 90 | 150): string {
  return minutes === 90 ? "1.5" : "2.5";
}

export default async function PartiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "zh" ? "zh" : "en";
  const t = await getTranslations({ locale, namespace: "parties" });
  const [partiesResult, settings] = await Promise.all([
    loadPartiesPageData(),
    loadSiteSettings(),
  ]);
  const verifiedLivePackages = partiesResult.ok
    ? partiesResult.data
        .map(toVerifiedPartyCard)
        .filter((party): party is PartyCard & { id: string } =>
          Boolean(party?.id),
        )
    : [];
  const hasCompleteLiveCatalogue =
    verifiedLivePackages.length === 2 &&
    verifiedLivePackages.some(
      (party) => party.guestDurationMinutes === 90,
    ) &&
    verifiedLivePackages.some(
      (party) => party.guestDurationMinutes === 150,
    );
  const packages = hasCompleteLiveCatalogue
    ? verifiedLivePackages
    : FALLBACK_PACKAGES;
  const requestsEnabled =
    settings.requestCapabilities.party && hasCompleteLiveCatalogue;

  return (
    <div className="overflow-hidden bg-[var(--public-canvas)] pb-20">
      <section className="relative border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_top_right,rgba(217,111,158,0.2),transparent_42%),linear-gradient(135deg,#FBF8F6_0%,#FFF_58%,rgba(242,223,230,0.7)_100%)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:items-center md:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-caramel">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold leading-tight text-warm-charcoal md:text-6xl">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-warm-grey md:text-lg">
              {t("subtitle")}
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-sm font-semibold text-warm-charcoal">
              <span className="rounded-full border border-[var(--public-border)] bg-white/85 px-4 py-2">
                {t("attendance")}
              </span>
              <span className="rounded-full border border-[var(--public-border)] bg-white/85 px-4 py-2">
                {t("minimumSpend")}
              </span>
            </div>
          </div>

          <div className="relative border border-white/80 bg-white/75 p-4 shadow-xl shadow-[rgba(217,111,158,0.12)] backdrop-blur">
            <div className="grid gap-3">
              <div className="rounded-2xl bg-[var(--public-rose-paper)] p-5 text-[var(--public-ink)]">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--public-muted)]">
                  {t("paymentTitle")}
                </p>
                <p className="mt-3 font-serif text-2xl font-semibold">
                  A$95 <span className="text-[var(--public-muted)]/50">/</span> A$145
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
                  {t("paymentBody")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--public-blush)] p-4">
                  <p className="text-2xl font-bold text-warm-charcoal">1.5h</p>
                  <p className="mt-1 text-xs text-warm-grey">
                    {t("standardName")}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--public-rose-paper)] p-4">
                  <p className="text-2xl font-bold text-warm-charcoal">2.5h</p>
                  <p className="mt-1 text-xs text-warm-grey">
                    {t("extendedName")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        <section className="-mt-4 grid gap-5 md:grid-cols-2">
          {packages.map((party) => {
            const canRequest = requestsEnabled && Boolean(party.id);
            const packageName =
              party.guestDurationMinutes === 90
                ? t("standardName")
                : t("extendedName");
            return (
              <article
                className="relative overflow-hidden border border-warm-grey/15 bg-white p-6 shadow-sm sm:p-8"
                key={`${party.guestDurationMinutes}-${party.id ?? "fallback"}`}
              >
                {party.imageUrl && (
                  <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-2xl">
                    <Image
                      alt={`${packageName} — YezYY`}
                      className="object-cover"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      src={party.imageUrl}
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-caramel">
                      {formatHours(party.guestDurationMinutes)} {t("guestUse")}
                    </p>
                    <h2 className="mt-2 font-serif text-3xl font-bold text-warm-charcoal">
                      {packageName}
                    </h2>
                  </div>
                  <p className="rounded-full bg-caramel px-4 py-2 text-lg font-bold text-white">
                    A${party.venueFeeCents / 100}
                  </p>
                </div>
                <ul className="mt-6 space-y-3 text-sm leading-6 text-warm-charcoal">
                  {[t("attendance"), t("minimumSpend"), t("setupCleanup")].map(
                    (item) => (
                      <li className="flex gap-3" key={item}>
                        <span aria-hidden="true" className="text-sage">
                          ●
                        </span>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-5 rounded-xl bg-cream px-4 py-3 text-sm leading-6 text-warm-grey">
                  {t("timeRequest")}
                </p>
                {canRequest && party.id && (
                  <PartyInquiryCTA
                    party={{
                      id: party.id,
                      name: party.name,
                      minPeople: party.minPeople,
                      maxPeople: party.maxPeople,
                      priceIndicator: `A$${party.venueFeeCents / 100}`,
                      guestDurationMinutes: party.guestDurationMinutes,
                      setupMinutes: party.setupMinutes,
                      cleanupMinutes: party.cleanupMinutes,
                      venueFeeCents: party.venueFeeCents,
                      minSpendPerPersonCents:
                        party.minSpendPerPersonCents,
                      minParents: party.minParents,
                      maxParents: party.maxParents,
                    }}
                    requestEnabled
                  />
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-14 grid gap-5 lg:grid-cols-3">
          <article className="border border-[var(--public-border)] bg-[var(--public-blush)] p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
              {t("includedTitle")}
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-warm-charcoal">
              {[
                t("includedDecorations"),
                t("includedGift"),
                t("includedVoucher"),
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <span aria-hidden="true" className="text-caramel">
                    ✦
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="border border-[var(--public-border)] bg-[var(--public-rose-paper)] p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
              {t("byoTitle")}
            </h2>
            <p className="mt-4 text-sm leading-6 text-warm-charcoal">
              {t("byoBody")}
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-warm-grey">
              <li>{t("cakeCutting")}</li>
              <li>{t("cleaning")}</li>
              <li>{t("overtime")}</li>
            </ul>
          </article>

          <article className="border border-[var(--public-border)] bg-white p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
              {t("paymentTitle")}
            </h2>
            <p className="mt-4 text-sm leading-6 text-warm-charcoal">
              {t("paymentBody")}
            </p>
            <p className="mt-4 text-sm leading-6 text-warm-grey">
              {t("refund")}
            </p>
          </article>
        </section>

        <section className="mt-14 rounded-3xl border border-warm-grey/15 bg-white p-6 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-serif text-3xl font-bold text-warm-charcoal">
              {t("contactTitle")}
            </h2>
            {!requestsEnabled && (
              <div className="mt-6">
                <RequestContactFallback locale={locale} />
              </div>
            )}
            <address className="mt-6 text-sm not-italic leading-7 text-warm-grey">
              <p>{YEZYY_BUSINESS_PROFILE.address}</p>
              <p>
                <a
                  className="text-caramel underline-offset-4 hover:underline"
                  href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
                >
                  {YEZYY_BUSINESS_PROFILE.phone}
                </a>
                {" · "}
                <a
                  className="text-caramel underline-offset-4 hover:underline"
                  href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
                >
                  {YEZYY_BUSINESS_PROFILE.email}
                </a>
              </p>
              <p>
                {locale === "zh" ? "小红书" : "Xiaohongshu"}:{" "}
                {YEZYY_BUSINESS_PROFILE.xiaohongshu}
              </p>
              <p>{YEZYY_BUSINESS_PROFILE.currency}</p>
            </address>
          </div>
        </section>
      </main>
    </div>
  );
}
