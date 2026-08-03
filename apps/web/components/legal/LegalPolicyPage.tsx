import { Link } from "@/i18n/routing";
import { getLegalPolicy, type LegalPolicySlug } from "@/lib/legal/policies";
import { YEZYY_BUSINESS_PROFILE } from "@/lib/site/business";

const NAV = {
  en: [
    ["Privacy Policy", "/privacy"],
    ["Booking Terms", "/booking-terms"],
    ["Cancellation & Rescheduling", "/cancellation-rescheduling"],
    ["Party Terms", "/party-terms"],
  ],
  zh: [
    ["隐私政策", "/privacy"],
    ["预约条款", "/booking-terms"],
    ["取消与改期", "/cancellation-rescheduling"],
    ["派对条款", "/party-terms"],
  ],
} as const;

export default function LegalPolicyPage({
  locale,
  slug,
}: {
  locale: "en" | "zh";
  slug: LegalPolicySlug;
}) {
  const policy = getLegalPolicy(locale, slug);
  return (
    <div className="bg-[var(--public-canvas)] px-4 py-12 text-[var(--public-ink)] sm:py-18">
      <article className="mx-auto max-w-4xl">
        <header className="rounded-[2rem] border border-[var(--public-border)] bg-white p-6 shadow-[0_18px_50px_rgba(74,58,62,0.08)] sm:p-10">
          <p className="text-sm font-semibold tracking-[0.16em] text-[var(--public-pink)] uppercase">
            {locale === "zh" ? "YezYY 营业政策" : "YezYY studio policies"}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">
            {policy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--public-muted)]">
            {policy.description}
          </p>
          <p className="mt-5 text-sm text-[var(--public-muted)]">
            {policy.updated}
          </p>
        </header>

        <nav
          aria-label={locale === "zh" ? "营业政策" : "Studio policies"}
          className="my-6 flex flex-wrap gap-2"
        >
          {NAV[locale].map(([label, href]) => (
            <Link
              className="rounded-full border border-[var(--public-border)] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--public-pink)]"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>

        {policy.important ? (
          <p className="rounded-2xl border border-[var(--public-pink)]/25 bg-[var(--public-blush)] p-5 leading-7 font-medium">
            {policy.important}
          </p>
        ) : null}

        <div className="mt-6 space-y-5">
          {policy.sections.map((section) => (
            <section
              className="rounded-3xl border border-[var(--public-border)] bg-white p-6 sm:p-8"
              key={section.heading}
            >
              <h2 className="font-serif text-2xl font-semibold">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  className="mt-4 text-sm leading-7 text-[var(--public-muted)] sm:text-base"
                  key={paragraph}
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--public-muted)] sm:text-base">
                  {section.bullets.map((item) => (
                    <li className="flex gap-3" key={item}>
                      <span
                        aria-hidden="true"
                        className="text-[var(--public-pink)]"
                      >
                        •
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <aside className="mt-6 rounded-3xl bg-[var(--public-footer)] p-6 text-sm leading-7 text-[var(--public-muted)] sm:p-8">
          <h2 className="font-serif text-xl font-semibold text-[var(--public-ink)]">
            {locale === "zh" ? "联系 YezYY" : "Contact YezYY"}
          </h2>
          <p className="mt-2">{YEZYY_BUSINESS_PROFILE.address}</p>
          <p>
            <a href={`tel:${YEZYY_BUSINESS_PROFILE.phone.replace(/\D/g, "")}`}>
              {YEZYY_BUSINESS_PROFILE.phone}
            </a>
            {" · "}
            <a href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}>
              {YEZYY_BUSINESS_PROFILE.email}
            </a>
          </p>
          <p className="mt-3">
            {locale === "zh"
              ? "这些页面是 YezYY 当前营业规则的说明，并非针对个人情况的法律意见。"
              : "These pages describe YezYY’s current operating rules and are not legal advice for an individual situation."}
          </p>
        </aside>
      </article>
    </div>
  );
}
