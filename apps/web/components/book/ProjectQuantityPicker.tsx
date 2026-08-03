"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

export type OrdinaryBookingProject = {
  id: string;
  name: { en: string; zh: string };
  category: {
    id: string;
    name: { en: string; zh: string };
    slug: string;
  };
  durationMinutes: 30 | 60;
  priceDisplay?: string;
  priceMinCents?: number | null;
  priceMaxCents?: number | null;
};

export type OrdinaryBookingItemSelection =
  | {
      projectId: string;
      quantity: number;
      decideInStore: false;
    }
  | {
      quantity: number;
      decideInStore: true;
    };

type ProjectQuantityPickerProps = {
  locale?: "en" | "zh";
  projects: OrdinaryBookingProject[];
  participantCount: number;
  value?: OrdinaryBookingItemSelection[];
  onChange?: (items: OrdinaryBookingItemSelection[]) => void;
  showValidation?: boolean;
};

const COPY = {
  en: {
    price: "Prices are in AUD and are paid in store.",
    decide: "Decide in store",
    decideBody: "Choose your project when you arrive.",
    decidePrice: "No online price snapshot. This choice reserves 60 minutes.",
    quantity: (name: string) => `${name} quantity`,
    assigned: (selected: number, participants: number) =>
      `${selected} of ${participants} participants assigned`,
    parity: "Choose exactly one project for each DIY participant.",
    choose: "Choose a project to continue.",
    categories: "DIY categories",
    duration: (duration?: number) =>
      `Estimated booking time: ${duration ? `${duration} minutes` : "—"}`,
    projectDuration: (duration: number) => `${duration} minutes`,
  },
  zh: {
    price: "所有价格均为澳元，并在店内付款。",
    decide: "到店决定",
    decideBody: "到店后再选择手作项目。",
    decidePrice: "不会生成线上价格快照；此选项预留 60 分钟。",
    quantity: (name: string) => `${name}数量`,
    assigned: (selected: number, participants: number) =>
      `已为 ${participants} 位参与者分配 ${selected} 个项目`,
    parity: "每位手作参与者须选择一个项目。",
    choose: "请选择项目后继续。",
    categories: "手作类别",
    duration: (duration?: number) =>
      `预计预约时长：${duration ? `${duration} 分钟` : "—"}`,
    projectDuration: (duration: number) => `${duration} 分钟`,
  },
} as const;

export function summarizeProjectSelection(
  items: OrdinaryBookingItemSelection[],
  projects: OrdinaryBookingProject[],
) {
  const quantity = items.reduce((total, item) => total + item.quantity, 0);
  const durations = items.map((item) => {
    if (item.decideInStore) return 60;
    return (
      projects.find((project) => project.id === item.projectId)
        ?.durationMinutes ?? 0
    );
  });
  return {
    quantity,
    durationMinutes: durations.length
      ? (Math.max(...durations) as 30 | 60)
      : undefined,
  };
}

function quantityFor(
  items: OrdinaryBookingItemSelection[],
  projectId?: string,
) {
  return (
    items.find((item) =>
      projectId
        ? !item.decideInStore && item.projectId === projectId
        : item.decideInStore,
    )?.quantity ?? 0
  );
}

export default function ProjectQuantityPicker({
  locale = "en",
  projects,
  participantCount,
  value,
  onChange,
  showValidation = false,
}: ProjectQuantityPickerProps) {
  const id = useId();
  const copy = COPY[locale];
  const [internalItems, setInternalItems] = useState<
    OrdinaryBookingItemSelection[]
  >([]);
  const items = value ?? internalItems;
  const latestItems = useRef(items);
  useLayoutEffect(() => {
    if (value !== undefined) latestItems.current = value;
  }, [value]);
  const categories = projects.reduce<OrdinaryBookingProject["category"][]>(
    (current, project) =>
      current.some((category) => category.id === project.category.id)
        ? current
        : [...current, project.category],
    [],
  );
  const selectedProjectId = items.find(
    (
      item,
    ): item is Extract<
      OrdinaryBookingItemSelection,
      { decideInStore: false }
    > => !item.decideInStore,
  )?.projectId;
  const initialCategoryId =
    projects.find((project) => project.id === selectedProjectId)?.category.id ??
    categories[0]?.id ??
    "";
  const [activeCategoryId, setActiveCategoryId] = useState(initialCategoryId);
  const [touched, setTouched] = useState(false);
  const summary = summarizeProjectSelection(items, projects);
  const parityError = summary.quantity !== participantCount;
  const displayParityError = parityError && (showValidation || touched);
  const parityErrorId = `${id}-parity-error`;

  const setQuantity = (projectId: string | undefined, quantity: number) => {
    setTouched(true);
    const currentItems = latestItems.current;
    const remaining = projectId
      ? currentItems.filter(
          (item) => !item.decideInStore && item.projectId !== projectId,
        )
      : currentItems.filter((item) => !item.decideInStore);
    let next = remaining;
    if (quantity > 0) {
      next = projectId
        ? [...remaining, { projectId, quantity, decideInStore: false as const }]
        : [{ quantity, decideInStore: true as const }];
    }
    next.sort((left, right) => {
      const leftIndex = left.decideInStore
        ? projects.length
        : projects.findIndex((project) => project.id === left.projectId);
      const rightIndex = right.decideInStore
        ? projects.length
        : projects.findIndex((project) => project.id === right.projectId);
      return leftIndex - rightIndex;
    });
    latestItems.current = next;
    if (value === undefined) setInternalItems(next);
    onChange?.(next);
  };

  const renderQuantity = (label: string, projectId: string | undefined) => (
    <input
      aria-describedby={displayParityError ? parityErrorId : undefined}
      aria-invalid={displayParityError}
      aria-label={copy.quantity(label)}
      className="min-h-11 w-20 rounded-xl border border-warm-grey/25 bg-white px-3 text-center text-base font-semibold text-warm-charcoal transition outline-none focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25"
      inputMode="numeric"
      max={Math.max(1, participantCount)}
      min="0"
      onChange={(event) =>
        setQuantity(
          projectId,
          Math.max(0, Number.parseInt(event.target.value, 10) || 0),
        )
      }
      type="number"
      value={quantityFor(items, projectId)}
    />
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-warm-grey">{copy.price}</p>
      <div
        aria-label={copy.categories}
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
      >
        {categories.map((category) => (
          <button
            aria-pressed={category.id === activeCategoryId}
            className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              category.id === activeCategoryId
                ? "border-caramel bg-caramel text-white"
                : "border-warm-grey/20 bg-white text-warm-charcoal hover:border-caramel/60"
            }`}
            key={category.id}
            onClick={() => setActiveCategoryId(category.id)}
            type="button"
          >
            {category.name[locale]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects
          .filter((project) => project.category.id === activeCategoryId)
          .map((project, index) => {
          const name = project.name[locale];
          const selected = quantityFor(items, project.id) > 0;
          const accents = [
            "border-l-soft-pink",
            "border-l-sage",
            "border-l-lavender",
            "border-l-caramel",
          ];
          return (
            <article
                className={`flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-l-4 border-warm-grey/15 bg-white p-4 shadow-sm transition ${
                accents[index % accents.length]
              } ${selected ? "ring-2 ring-caramel/25" : ""}`}
              key={project.id}
            >
              <div>
                <h3 className="font-serif text-base font-semibold text-warm-charcoal">
                  {name}
                </h3>
                <p className="mt-1 text-sm text-warm-grey">
                  {copy.projectDuration(project.durationMinutes)}
                  {project.priceDisplay ? ` · ${project.priceDisplay}` : ""}
                </p>
              </div>
              {renderQuantity(name, project.id)}
            </article>
          );
        })}
      </div>
      <article className="flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-l-4 border-warm-grey/15 border-l-warm-charcoal bg-cream/60 p-4">
          <div>
            <h3 className="font-serif text-base font-semibold text-warm-charcoal">
              {copy.decide}
            </h3>
            <p className="mt-1 text-sm text-warm-grey">{copy.decideBody}</p>
            <p className="mt-1 text-xs leading-5 text-warm-grey">
              {copy.decidePrice}
            </p>
          </div>
          {renderQuantity(copy.decide, undefined)}
        </article>
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          displayParityError
            ? "border-red-300 bg-red-50 text-red-800"
            : parityError
              ? "border-warm-grey/15 bg-cream/60 text-warm-grey"
            : "border-sage/35 bg-sage/10 text-warm-charcoal"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong>
            {parityError && !displayParityError
              ? copy.choose
              : copy.assigned(summary.quantity, participantCount)}
          </strong>
          <span>{copy.duration(summary.durationMinutes)}</span>
        </div>
        {displayParityError && (
          <p
            className="mt-1"
            data-testid="project-parity-error"
            id={parityErrorId}
            role="alert"
          >
            {copy.parity}
          </p>
        )}
      </div>
    </div>
  );
}
