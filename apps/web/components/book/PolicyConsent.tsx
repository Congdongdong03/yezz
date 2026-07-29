"use client";

import { useId } from "react";
import {
  YEZYY_BUSINESS_PROFILE,
  formatPhoneHref,
} from "@/lib/site/business";

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
      "Request at least two hours ahead and no more than seven calendar days ahead, using Melbourne local time.",
      "Minimum age is 5. Children aged 5–8 require an accompanying adult; participants and accompanying adults count toward the physical capacity of 8.",
      "Submission is a request only. YezYY staff must manually confirm it before it becomes a booking.",
      "Prices are in AUD. Pay in store; there is no online payment.",
      "If you are more than 20 minutes late, the original time is no longer guaranteed and staff may rearrange your visit.",
      "Cancellation or rescheduling requested at least two hours before the start is free. Later requests are at staff discretion. There is no cancellation fee.",
      "Your contact details are used to review this request and communicate booking updates.",
    ],
    consent:
      "I understand and accept the booking, age and supervision, cancellation, rescheduling, and privacy policies.",
    contact: "Need help? Contact YezYY:",
    xiaohongshu: "Xiaohongshu",
  },
  zh: {
    title: "提交申请前",
    policies: [
      "请按墨尔本当地时间至少提前两小时申请，且只能申请未来七个日历日内的日期。",
      "最低年龄为 5 岁。5 至 8 岁儿童须由成人陪同；手作参与者与陪同成人均计入店内最多 8 人的实际容量。",
      "提交后仅代表提出申请。必须由 YezYY 员工人工确认后，才会成为正式预约。",
      "所有价格均为澳元。请到店付款；网站不提供线上付款。",
      "迟到超过 20 分钟，原时段将不再保证，员工可能重新安排您的到店时间。",
      "至少在开始前两小时提出取消或改期可免费办理；不足两小时由员工酌情处理。我们不收取取消费。",
      "您的联系信息仅用于审核本次申请及发送预约状态通知。",
    ],
    consent: "我已了解并接受预约、年龄与陪同、取消、改期及隐私政策。",
    contact: "需要协助？请联系 YezYY：",
    xiaohongshu: "小红书",
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
      <div className="mt-4 rounded-xl bg-white/80 p-4 text-sm leading-6 text-warm-grey">
        <p>{copy.contact}</p>
        <address className="mt-1 not-italic">
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
            {copy.xiaohongshu}: {YEZYY_BUSINESS_PROFILE.xiaohongshu}
          </p>
        </address>
      </div>
      <label
        className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-warm-grey/20 bg-white p-4 text-sm font-medium leading-6 text-warm-charcoal focus-within:ring-2 focus-within:ring-caramel/30"
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
