"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MessageCircle, Check } from "lucide-react";

export default function PartyInquiryCTA({ wechatId }: { wechatId?: string }) {
  const t = useTranslations("parties");
  const [copied, setCopied] = useState(false);

  const handleCopyWeChat = async () => {
    const id = wechatId || "yezz_studio";
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

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Link
        href="/contact"
        className="inline-flex flex-1 items-center justify-center rounded-full bg-caramel px-6 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
      >
        {t("inquireContact")}
      </Link>
      <button
        type="button"
        onClick={handleCopyWeChat}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-caramel px-6 py-2.5 text-sm font-medium text-caramel transition-colors hover:bg-caramel hover:text-white"
      >
        {copied ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        {copied ? t("wechatCopied") : t("inquireWechat")}
      </button>
    </div>
  );
}
