"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MessageCircle, Check } from "lucide-react";
import PartyBookingForm, {
  type PartyBookingFormParty,
} from "./PartyBookingForm";
import RequestContactFallback from "@/components/RequestContactFallback";
import { useLocale } from "next-intl";

export default function PartyInquiryCTA({
  party,
  wechatId,
  requestEnabled = false,
}: {
  party?: PartyBookingFormParty;
  wechatId?: string;
  requestEnabled?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("parties");
  const [copied, setCopied] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const formId = party ? `party-request-${party.id}` : undefined;

  const handleCopyWeChat = async () => {
    if (!wechatId) return;
    const id = wechatId;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = id;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!requestEnabled) {
    return (
      <div className="mt-6">
        <RequestContactFallback locale={locale} />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        {party ? (
          <button
            aria-controls={formId}
            aria-expanded={requestOpen}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-caramel px-6 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2"
            onClick={() => setRequestOpen((open) => !open)}
            type="button"
          >
            {requestOpen ? t("closeRequest") : t("requestPackage")}
          </button>
        ) : (
          <Link
            href="/contact"
            className="inline-flex flex-1 items-center justify-center rounded-full bg-caramel px-6 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {t("inquireContact")}
          </Link>
        )}
        {wechatId && (
          <button
            type="button"
            onClick={handleCopyWeChat}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-caramel px-6 py-2.5 text-sm font-medium text-caramel transition-colors hover:bg-caramel hover:text-white"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {copied ? t("wechatCopied") : t("inquireWechat")}
          </button>
        )}
      </div>
      {party && requestOpen && (
        <div className="mt-5 scroll-mt-24" id={formId}>
          <PartyBookingForm party={party} />
        </div>
      )}
    </div>
  );
}
