"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

export default function WeChatCTA() {
  const t = useTranslations("home.wechatCta");

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
              onClick={() => {
                alert("WeChat ID copied!");
              }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-caramel px-8 py-3 text-lg font-medium text-caramel transition-colors hover:bg-caramel hover:text-white"
            >
              <MessageCircle className="h-5 w-5" />
              {t("wechat")}
            </button>
            <Link
              href="/book"
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
