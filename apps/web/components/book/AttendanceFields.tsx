"use client";

import { useId, useState } from "react";

export type OrdinaryAttendance = {
  participantCount: number;
  youngChildCount: number;
  accompanyingAdultCount: number;
};

type AttendanceFieldsProps = {
  locale: "en" | "zh";
  value?: OrdinaryAttendance;
  onChange?: (value: OrdinaryAttendance) => void;
};

const COPY = {
  en: {
    participants: "DIY participants",
    children: "Children aged 5–8",
    adults: "Accompanying adults",
    age:
      "Minimum age is 5. Guests aged 9 or older may attend without an accompanying adult.",
    physical: (count: number) => `${count} people in the studio`,
    capacity: "Physical attendance has a maximum of 8 people.",
    supervision:
      "An accompanying adult is required when a child aged 5–8 attends.",
    participantInvalid: "Choose at least one DIY participant.",
    childInvalid:
      "Children aged 5–8 cannot exceed the number of DIY participants.",
    adultInvalid: "Accompanying adults cannot be negative.",
    countHint:
      "DIY participants and non-participating accompanying adults both count.",
  },
  zh: {
    participants: "手作参与者",
    children: "5 至 8 岁儿童",
    adults: "陪同成人",
    age: "最低年龄为 5 岁；9 岁及以上可不由成人陪同。",
    physical: (count: number) => `到店共 ${count} 人`,
    capacity: "店内实际人数最多 8 人。",
    supervision: "有 5 至 8 岁儿童参加时，至少需要一位陪同成人。",
    participantInvalid: "至少需要一位手作参与者。",
    childInvalid: "5 至 8 岁儿童人数不能超过手作参与者人数。",
    adultInvalid: "陪同成人不能为负数。",
    countHint: "手作参与者和不参加手作的陪同成人均计入店内人数。",
  },
} as const;

export function validateOrdinaryAttendance(value: OrdinaryAttendance) {
  const errors: Partial<Record<keyof OrdinaryAttendance, string>> = {};
  if (!Number.isInteger(value.participantCount) || value.participantCount < 1) {
    errors.participantCount = "participant";
  }
  if (
    !Number.isInteger(value.youngChildCount) ||
    value.youngChildCount < 0 ||
    value.youngChildCount > value.participantCount
  ) {
    errors.youngChildCount = "children";
  }
  if (
    !Number.isInteger(value.accompanyingAdultCount) ||
    value.accompanyingAdultCount < 0
  ) {
    errors.accompanyingAdultCount = "adults";
  } else if (
    value.youngChildCount > 0 &&
    value.accompanyingAdultCount < 1
  ) {
    errors.accompanyingAdultCount = "supervision";
  } else if (
    value.participantCount + value.accompanyingAdultCount >
    8
  ) {
    errors.accompanyingAdultCount = "capacity";
  }
  return errors;
}

export default function AttendanceFields({
  locale,
  value,
  onChange,
}: AttendanceFieldsProps) {
  const id = useId();
  const copy = COPY[locale];
  const [internalValue, setInternalValue] = useState<OrdinaryAttendance>({
    participantCount: 1,
    youngChildCount: 0,
    accompanyingAdultCount: 0,
  });
  const current = value ?? internalValue;
  const errors = validateOrdinaryAttendance(current);
  const attendance =
    current.participantCount + current.accompanyingAdultCount;
  const supervisionId = `${id}-supervision`;

  const setField = (
    field: keyof OrdinaryAttendance,
    nextValue: number,
  ) => {
    const next = { ...current, [field]: nextValue };
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  };

  const errorMessage = (field: keyof OrdinaryAttendance) => {
    const error = errors[field];
    if (error === "participant") return copy.participantInvalid;
    if (error === "children") return copy.childInvalid;
    if (error === "adults") return copy.adultInvalid;
    if (error === "supervision") return copy.supervision;
    if (error === "capacity") return copy.capacity;
    return undefined;
  };

  const fields: Array<{
    field: keyof OrdinaryAttendance;
    label: string;
    max: number;
  }> = [
    { field: "participantCount", label: copy.participants, max: 8 },
    {
      field: "youngChildCount",
      label: copy.children,
      max: Math.max(0, current.participantCount),
    },
    { field: "accompanyingAdultCount", label: copy.adults, max: 8 },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-warm-grey">{copy.age}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {fields.map(({ field, label, max }) => {
          const inputId = `${id}-${field}`;
          const validationError = errors[field];
          const fieldError = errorMessage(field);
          const errorId = `${inputId}-error`;
          const describedBy =
            validationError === "supervision"
              ? supervisionId
              : fieldError
                ? errorId
                : undefined;
          return (
            <div key={field}>
              <label
                className="text-sm font-semibold text-warm-charcoal"
                htmlFor={inputId}
              >
                {label}
              </label>
              <input
                aria-describedby={describedBy}
                aria-invalid={Boolean(fieldError)}
                className="mt-2 min-h-11 w-full rounded-xl border border-warm-grey/25 bg-white px-3 text-base text-warm-charcoal outline-none transition focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25"
                id={inputId}
                inputMode="numeric"
                max={max}
                min={field === "participantCount" ? 1 : 0}
                name={field}
                onChange={(event) =>
                  setField(field, Number.parseInt(event.target.value, 10) || 0)
                }
                type="number"
                value={current[field]}
              />
              {fieldError && validationError !== "supervision" && (
                <p
                  className="mt-1 text-sm text-red-700"
                  id={errorId}
                  role="alert"
                >
                  {fieldError}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {current.youngChildCount > 0 && (
        <p
          className="rounded-xl border border-lavender/50 bg-lavender/10 px-4 py-3 text-sm leading-6 text-warm-charcoal"
          id={supervisionId}
          role={
            errors.accompanyingAdultCount === "supervision"
              ? "alert"
              : undefined
          }
        >
          {copy.supervision}
        </p>
      )}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${
          attendance > 8
            ? "border-red-300 bg-red-50 text-red-800"
            : "border-sage/35 bg-sage/10 text-warm-charcoal"
        }`}
      >
        <strong>{copy.physical(attendance)}</strong>
        <span>{copy.countHint}</span>
      </div>
    </div>
  );
}
