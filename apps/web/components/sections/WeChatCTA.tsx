"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { MessageCircle, Check } from "lucide-react";

export default function WeChatCTA({ wechatId }: { wechatId?: string }) {
  const t = useTranslations("home.wechatCta");
  const [copied, setCopied] = useState(false);

  const handleCopyWeChat = async () => {
    const id = wechatId || "yezz_studio";
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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
    <section className="py-20 bg-cream">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-6 text-lg text-warm-grey">{t("subtitle")}</p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={handleCopyWeChat}
              className="inline-flex items-center gap-2 rounded-full border-2 border-caramel px-8 py-3 text-lg font-medium text-caramel transition-colors hover:bg-caramel hover:text-white"
            >
              {copied ? (
                <Check className="h-5 w-5" />
              ) : (
                <MessageCircle className="h-5 w-5" />
              )}
              {copied ? t("copied") : t("wechat")}
            </button>
            <Link
              href="/projects"
              className="inline-block rounded-full bg-caramel px-8 py-3 text-lg font-medium text-white transition-transform hover:-translate-y-1"
            >
              {t("book")}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
