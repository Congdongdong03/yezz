"use client";

import { useId } from "react";

type PolicyConsentProps = {
  locale: "en" | "zh";
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
};

const COPY = {
  en: {
    title: "Before you send the request",
    policies: [
      "Your request is not confirmed until YezYY staff confirms it.",
      "Payment is in store; there is no online payment.",
      "Minimum age is 5 and maximum physical attendance is 8. If you are more than 20 minutes late, staff may need to rearrange your visit.",
    ],
    consent:
      "I understand and accept the booking, age and supervision, cancellation, rescheduling, and privacy policies.",
    read: "Read the policies:",
    links: [
      ["Booking Terms", "booking-terms"],
      ["Cancellation & Rescheduling", "cancellation-rescheduling"],
      ["Privacy Policy", "privacy"],
    ],
  },
  zh: {
    title: "提交申请前",
    policies: [
      "申请须经 YezYY 员工人工确认后，才成为正式预约。",
      "请到店付款；网站不提供线上付款。",
      "最低年龄为 5 岁，店内实际人数最多 8 人；迟到超过 20 分钟可能需要重新安排。",
    ],
    consent: "我已了解并接受预约、年龄与陪同、取消、改期及隐私政策。",
    read: "查看对应政策：",
    links: [
      ["预约条款", "booking-terms"],
      ["取消与改期", "cancellation-rescheduling"],
      ["隐私政策", "privacy"],
    ],
  },
} as const;

export default function PolicyConsent({
  locale,
  checked,
  onChange,
  error,
}: PolicyConsentProps) {
  const id = useId();
  const copy = COPY[locale];
  const errorId = `${id}-error`;

  return (
    <section className="rounded-2xl border border-lavender/60 bg-lavender/10 p-5 sm:p-6">
      <h3 className="font-serif text-lg font-semibold text-warm-charcoal">
        {copy.title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-warm-charcoal">
        {copy.policies.map((policy) => (
          <li className="flex gap-2" key={policy}>
            <span aria-hidden="true" className="text-caramel">
              •
            </span>
            <span>{policy}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-sm leading-6 text-warm-grey">
        <span>{copy.read}</span>{" "}
        {copy.links.map(([label, slug], index) => (
          <span key={slug}>
            {index > 0 ? " · " : ""}
            <a
              className="font-semibold text-caramel underline underline-offset-4"
              href={`/${locale}/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label}
            </a>
          </span>
        ))}
      </div>
      <label
        className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-warm-grey/20 bg-white p-4 text-sm leading-6 font-medium text-warm-charcoal focus-within:ring-2 focus-within:ring-caramel/30"
        htmlFor={id}
      >
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          checked={checked}
          className="mt-1 h-5 w-5 shrink-0 accent-caramel"
          id={id}
          name="policyAccepted"
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
          value="true"
        />
        <span>{copy.consent}</span>
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-700" id={errorId} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
