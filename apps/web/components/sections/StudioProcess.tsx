import EditorialImage from "@/components/public/EditorialImage";
import {
  getEditorialMedia,
  type PublicLocale,
} from "@/lib/editorial/media";

type StudioProcessProps = {
  locale: PublicLocale;
};

const copy = {
  en: {
    eyebrow: "Your studio session",
    title: "Choose a project. Make it your own.",
    body: "No experience needed. Pick a project, settle into the studio, and our team will help you get started.",
    steps: [
      ["01", "Choose a project", "Browse the materials and find a pace that feels right for you."],
      ["02", "Make it yours", "Build, decorate, and add the tiny details that make it personal."],
      ["03", "Take it home", "Leave with something made by hand and a little more colour in your day."],
    ],
  },
  zh: {
    eyebrow: "你的手作时光",
    title: "选一个项目，把它做成自己的样子。",
    body: "不需要经验。选择项目，坐进工作台，我们的店员会帮你开始创作。",
    steps: [
      ["01", "选择项目", "看看材料，找到适合自己的节奏。"],
      ["02", "做成自己的样子", "制作、装饰，把小细节变成你的个人表达。"],
      ["03", "带回家", "带走亲手完成的作品，也让一天多一点色彩。"],
    ],
  },
} as const;

export default function StudioProcess({ locale }: StudioProcessProps) {
  const t = copy[locale];
  const beading = getEditorialMedia("beading");
  const ceramic = getEditorialMedia("ceramic-decorating");
  const materials = getEditorialMedia("craft-materials");

  return (
    <section className="overflow-hidden bg-[var(--public-rose-paper)] py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="public-eyebrow">{t.eyebrow}</p>
          <h2 className="mt-4 max-w-lg font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[var(--public-ink)] sm:text-5xl">
            {t.title}
          </h2>
          <p className="mt-6 max-w-xl text-base leading-8 text-[var(--public-muted)] sm:text-lg">
            {t.body}
          </p>
          <ol className="mt-10 space-y-5">
            {t.steps.map(([number, title, body]) => (
              <li
                key={number}
                className="grid grid-cols-[2.75rem_1fr] gap-4 border-t border-[var(--public-ink)]/10 pt-5"
              >
                <span className="font-mono text-xs tracking-[0.18em] text-[var(--public-pink)]">
                  {number}
                </span>
                <div>
                  <h3 className="font-medium text-[var(--public-ink)]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          <EditorialImage
            className="col-span-2 aspect-[16/10] overflow-hidden"
            media={ceramic}
            locale={locale}
            sizes="(max-width: 1024px) 100vw, 55vw"
            priority
          />
          <EditorialImage
            className="aspect-[4/5] overflow-hidden"
            media={beading}
            locale={locale}
            sizes="(max-width: 640px) 50vw, 28vw"
          />
          <EditorialImage
            className="mt-10 aspect-[4/5] overflow-hidden"
            media={materials}
            locale={locale}
            sizes="(max-width: 640px) 50vw, 28vw"
          />
        </div>
      </div>
    </section>
  );
}
