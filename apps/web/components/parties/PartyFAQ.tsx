type PartyFaqLocale = "en" | "zh";

const copy = {
  en: {
    eyebrow: "Before you request",
    title: "Party questions, answered",
    intro: "The essentials for planning a small DIY celebration at YezYY.",
    items: [
      {
        question: "Is my requested time confirmed immediately?",
        answer:
          "No. Your preferred time is a request only. A staff member will confirm it or contact you to arrange another available time.",
      },
      {
        question: "How many people can attend?",
        answer:
          "Packages are for 4–8 DIY participants. Children must be at least 5 years old, and 1–2 accompanying parents must remain present.",
      },
      {
        question: "What does each participant need to choose?",
        answer:
          "Each participant chooses at least one DIY project, with an A$45 minimum DIY spend per participant.",
      },
      {
        question: "Can we bring food and cake?",
        answer:
          "Yes. You may bring cake, drinks, food, and snacks. Staff cake cutting is A$15, and a cleaning charge of A$15–A$35 may apply.",
      },
      {
        question: "How is the deposit paid?",
        answer:
          "The A$95 or A$145 venue fee is also the deposit. Pay it in store during a separate visit before the party date. After confirmation, staff will tell you the payment deadline. There is no online payment.",
      },
      {
        question: "What if our plans change?",
        answer:
          "Cancel at least 48 hours before the final guest start for a full venue-fee refund. Later cancellation is non-refundable. Staff records the final outcome.",
      },
    ],
  },
  zh: {
    eyebrow: "提交申请前",
    title: "派对常见问题",
    intro: "在 YezYY 安排小型手作庆祝活动前需要了解的重点。",
    items: [
      {
        question: "提交时选择的时间会立即确认吗？",
        answer: "不会。首选时间仅为申请；店员会确认该时段，或联系您安排其他可用时间。",
      },
      {
        question: "可以有多少人参加？",
        answer: "派对适合 4 至 8 位手作参与者。儿童至少 5 岁，并需 1 至 2 位陪同家长全程在场。",
      },
      {
        question: "每位参与者需要选择什么？",
        answer: "每位参与者至少选择一个手作项目，每位手作项目最低消费 45 澳元。",
      },
      {
        question: "可以自带食物和蛋糕吗？",
        answer: "可以自带蛋糕、饮料、食物和零食。员工切蛋糕服务为 15 澳元；如适用，清洁费为 15–35 澳元。",
      },
      {
        question: "订金如何支付？",
        answer: "95 或 145 澳元场地费同时作为订金，需在派对日期前另行到店支付。确认后由店员告知付款期限。网站不提供线上付款。",
      },
      {
        question: "计划有变化怎么办？",
        answer: "至少在最终派对开始前 48 小时取消，可全额退还场地费；不足 48 小时不退款，最终结果由店员记录。",
      },
    ],
  },
} as const;

export default function PartyFAQ({ locale }: { locale: PartyFaqLocale }) {
  const t = copy[locale];

  return (
    <section className="mt-14 border border-[var(--public-border)] bg-[var(--public-paper)] px-6 py-10 sm:px-10 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="public-eyebrow">{t.eyebrow}</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-[var(--public-ink)] sm:text-4xl">
            {t.title}
          </h2>
          <p className="mt-4 max-w-md leading-7 text-[var(--public-muted)]">
            {t.intro}
          </p>
        </div>
        <div className="divide-y divide-[var(--public-border)] border-y border-[var(--public-border)]">
          {t.items.map((item, index) => (
            <details className="group py-5" key={item.question} open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-[var(--public-ink)] marker:hidden">
                <span>{item.question}</span>
                <span aria-hidden="true" className="text-xl text-[var(--public-pink)] transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-2xl pt-4 text-sm leading-7 text-[var(--public-muted)] sm:text-base">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
