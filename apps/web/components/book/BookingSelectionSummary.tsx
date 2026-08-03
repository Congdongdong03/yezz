import type { OrdinaryAttendance } from "./AttendanceFields";
import {
  summarizeProjectSelection,
  type OrdinaryBookingItemSelection,
  type OrdinaryBookingProject,
} from "./ProjectQuantityPicker";

type BookingSelectionSummaryProps = {
  attendance: OrdinaryAttendance;
  date: string;
  items: OrdinaryBookingItemSelection[];
  locale: "en" | "zh";
  projects: OrdinaryBookingProject[];
  startTime: string | null;
};

const COPY = {
  en: {
    label: "Booking selection summary",
    title: "Your request so far",
    projects: "Projects",
    people: "People",
    duration: "Time",
    price: "Price",
    session: "Session",
    empty: "Not chosen yet",
    decide: "Decide in store",
    makers: (makers: number, total: number) =>
      `${makers} makers · ${total} people attending`,
    minutes: (minutes?: number) => (minutes ? `${minutes} minutes` : "—"),
    inStorePrice: "Price confirmed after choosing in store",
  },
  zh: {
    label: "预约选择摘要",
    title: "当前预约选择",
    projects: "项目",
    people: "人数",
    duration: "时长",
    price: "价格",
    session: "时段",
    empty: "尚未选择",
    decide: "到店决定",
    makers: (makers: number, total: number) =>
      `${makers} 位手作参与者 · 共 ${total} 人到店`,
    minutes: (minutes?: number) => (minutes ? `${minutes} 分钟` : "—"),
    inStorePrice: "到店选择后确定价格",
  },
} as const;

function formatAud(cents: number) {
  return `A$${(cents / 100).toFixed(2)}`;
}

function priceSummary(
  items: OrdinaryBookingItemSelection[],
  projects: OrdinaryBookingProject[],
  fallback: string,
) {
  let minimum = 0;
  let maximum = 0;
  for (const item of items) {
    if (item.decideInStore) return fallback;
    const project = projects.find(
      (candidate) => candidate.id === item.projectId,
    );
    if (project?.priceMinCents == null) return fallback;
    minimum += project.priceMinCents * item.quantity;
    maximum += (project.priceMaxCents ?? project.priceMinCents) * item.quantity;
  }
  if (!items.length) return "—";
  return minimum === maximum
    ? formatAud(minimum)
    : `${formatAud(minimum)}–${formatAud(maximum)}`;
}

export default function BookingSelectionSummary({
  attendance,
  date,
  items,
  locale,
  projects,
  startTime,
}: BookingSelectionSummaryProps) {
  const copy = COPY[locale];
  const selection = summarizeProjectSelection(items, projects);
  const selectedProjects = items.map((item) => {
    const name = item.decideInStore
      ? copy.decide
      : (projects.find((project) => project.id === item.projectId)?.name[
          locale
        ] ?? copy.empty);
    return `${name} × ${item.quantity}`;
  });
  const totalPeople =
    attendance.participantCount + attendance.accompanyingAdultCount;

  return (
    <section
      aria-label={copy.label}
      className="sticky top-3 z-30 rounded-2xl border border-[var(--public-border)] bg-[var(--public-paper)]/95 p-4 shadow-[0_14px_34px_rgba(74,58,62,0.1)] backdrop-blur-md sm:p-5"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--public-pink)] uppercase">
        {copy.title}
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <dt className="text-xs text-[var(--public-muted)]">
            {copy.projects}
          </dt>
          <dd className="mt-1 font-medium text-[var(--public-ink)]">
            {selectedProjects.length
              ? selectedProjects.join(" · ")
              : copy.empty}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--public-muted)]">{copy.people}</dt>
          <dd className="mt-1 font-medium text-[var(--public-ink)]">
            {copy.makers(attendance.participantCount, totalPeople)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--public-muted)]">
            {copy.duration}
          </dt>
          <dd className="mt-1 font-medium text-[var(--public-ink)]">
            {copy.minutes(selection.durationMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--public-muted)]">{copy.price}</dt>
          <dd className="mt-1 font-medium text-[var(--public-ink)]">
            {priceSummary(items, projects, copy.inStorePrice)}
          </dd>
        </div>
        {date ? (
          <div className="sm:col-span-2 lg:col-span-5">
            <dt className="text-xs text-[var(--public-muted)]">
              {copy.session}
            </dt>
            <dd className="mt-1 font-medium text-[var(--public-ink)]">
              {date}
              {startTime ? ` · ${startTime}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
