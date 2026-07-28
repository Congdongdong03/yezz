import {
  YEZYY_BUSINESS_PROFILE,
  formatPhoneHref,
} from "@/lib/site/business";

export default function RequestContactFallback({
  locale,
}: {
  locale: string;
}) {
  const isChinese = locale.toLowerCase().startsWith("zh");

  return (
    <section
      className="rounded-2xl border border-warm-grey/15 bg-white p-6 text-center"
      data-testid="request-contact-fallback"
    >
      <h2 className="font-serif text-xl font-semibold text-warm-charcoal">
        {isChinese ? "线上申请暂未开放" : "Online requests are not available yet"}
      </h2>
      <p className="mt-2 text-sm text-warm-grey">
        {isChinese
          ? "欢迎致电或发送邮件，我们会协助您安排到店体验。"
          : "Call or email us and we’ll help arrange your studio visit."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <a
          className="text-caramel hover:underline"
          href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
        >
          {YEZYY_BUSINESS_PROFILE.phone}
        </a>
        <a
          className="text-caramel hover:underline"
          href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
        >
          {YEZYY_BUSINESS_PROFILE.email}
        </a>
      </div>
    </section>
  );
}
