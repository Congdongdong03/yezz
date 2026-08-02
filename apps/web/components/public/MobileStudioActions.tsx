"use client";

import { CalendarDays, MapPinned, Phone } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  formatPhoneHref,
  YEZYY_BUSINESS_PROFILE,
} from "@/lib/site/business";
import type { PublicMarketingCapabilities } from "./PublicHeader";

const copy = {
  en: {
    actions: "Studio actions",
    book: "Book DIY",
    party: "Plan a party",
    call: "Call",
    directions: "Directions",
  },
  zh: {
    actions: "门店快捷操作",
    book: "预约手作",
    party: "预约派对",
    call: "致电",
    directions: "导航",
  },
} as const;

export default function MobileStudioActions({
  capabilities,
}: {
  capabilities: PublicMarketingCapabilities;
}) {
  const locale = useLocale() === "zh" ? "zh" : "en";
  const t = copy[locale];
  const requestAction = capabilities.experience
    ? { href: "/book" as const, label: t.book }
    : capabilities.party
      ? { href: "/parties" as const, label: t.party }
      : null;
  const actionClass =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2.5 text-[0.7rem] font-semibold leading-none text-[var(--public-ink)] transition-colors hover:bg-[var(--public-blush)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--public-pink)]";

  return (
    <nav
      aria-label={t.actions}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--public-border)] bg-[var(--public-paper)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_rgba(74,58,62,0.1)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex max-w-lg divide-x divide-[var(--public-border)]">
        {requestAction ? (
          <Link
            href={requestAction.href}
            className={`${actionClass} bg-[var(--public-rose-paper)]`}
          >
            <CalendarDays aria-hidden="true" className="size-5 text-[var(--public-pink)]" />
            <span>{requestAction.label}</span>
          </Link>
        ) : null}
        <a
          className={actionClass}
          href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
        >
          <Phone aria-hidden="true" className="size-5 text-[var(--public-pink)]" />
          <span>{t.call}</span>
        </a>
        <a
          className={actionClass}
          href={YEZYY_BUSINESS_PROFILE.googleMapUrl}
          target="_blank"
          rel="noreferrer"
        >
          <MapPinned aria-hidden="true" className="size-5 text-[var(--public-pink)]" />
          <span>{t.directions}</span>
        </a>
      </div>
    </nav>
  );
}
