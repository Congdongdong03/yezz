"use client";

import { useId } from "react";
import type { PhotoConsentDecision } from "@/lib/booking/photo-consent";

const COPY = {
  en: {
    title: "Optional photo and video permission",
    body: "This is separate from your booking. Choosing no will not affect your request. Permission can be withdrawn for future use by contacting YezYY.",
    declined:
      "No permission — do not photograph or publish anyone covered by this request.",
    adult:
      "Adult only — I authorise YezYY to use photos or video of me for its website and social accounts. No children are covered.",
    guardian:
      "My child — I am the parent or legal guardian and authorise YezYY to use photos or video of my child for its website and social accounts. This does not cover other children at a party.",
    signer: "Full name of consenting adult / guardian",
    signerHelp: "Required only when permission is given.",
  },
  zh: {
    title: "可选照片与视频授权",
    body: "此授权与预约分开；选择不授权不会影响申请。可联系 YezYY 撤回未来使用授权。",
    declined: "不授权——请勿拍摄或发布本申请涉及人员的照片或视频。",
    adult:
      "仅成人——我授权 YezYY 将本人的照片或视频用于官网及社交账号；不包括儿童。",
    guardian:
      "本人子女——我是家长或法定监护人，授权 YezYY 将本人子女的照片或视频用于官网及社交账号；不包括派对中的其他儿童。",
    signer: "同意授权的成人／监护人全名",
    signerHelp: "仅在选择授权时必填。",
  },
} as const;

export default function PhotoConsentField({
  decision,
  error,
  locale,
  onDecisionChange,
  onSignerNameChange,
  signerName,
}: {
  decision: PhotoConsentDecision;
  error?: string;
  locale: "en" | "zh";
  onDecisionChange: (decision: PhotoConsentDecision) => void;
  onSignerNameChange: (name: string) => void;
  signerName: string;
}) {
  const id = useId();
  const copy = COPY[locale];
  const options: Array<[PhotoConsentDecision, string]> = [
    ["declined", copy.declined],
    ["adult_only", copy.adult],
    ["guardian_for_minor", copy.guardian],
  ];
  const positive = decision !== "declined";
  return (
    <fieldset className="rounded-2xl border border-sage/40 bg-sage/10 p-5 sm:p-6">
      <legend className="px-1 font-serif text-lg font-semibold text-warm-charcoal">
        {copy.title}
      </legend>
      <p className="text-sm leading-6 text-warm-grey">{copy.body}</p>
      <div className="mt-4 space-y-3">
        {options.map(([value, label]) => (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-4 text-sm leading-6 text-warm-charcoal"
            key={value}
          >
            <input
              checked={decision === value}
              className="mt-1 h-5 w-5 shrink-0 accent-caramel"
              name="photoConsentDecision"
              onChange={() => onDecisionChange(value)}
              type="radio"
              value={value}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {positive ? (
        <div className="mt-4">
          <label
            className="text-sm font-semibold text-warm-charcoal"
            htmlFor={id}
          >
            {copy.signer} *
          </label>
          <input
            aria-describedby={error ? `${id}-error` : `${id}-help`}
            aria-invalid={Boolean(error)}
            className="mt-2 min-h-11 w-full rounded-xl border border-warm-grey/25 bg-white px-3 text-base text-warm-charcoal outline-none focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25"
            id={id}
            name="photoConsentSignerName"
            onChange={(event) => onSignerNameChange(event.target.value)}
            value={signerName}
          />
          <p className="mt-1 text-xs text-warm-grey" id={`${id}-help`}>
            {copy.signerHelp}
          </p>
          {error ? (
            <p
              className="mt-1 text-sm text-red-700"
              id={`${id}-error`}
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
