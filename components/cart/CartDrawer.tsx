"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { X, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useCart } from "@/lib/cart/context";

export default function CartDrawer() {
  const { items, removeItem, isOpen, setIsOpen } = useCart();
  const locale = useLocale();
  const t = useTranslations("cart");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-warm-grey/10 px-6 py-4">
              <h2 className="font-serif text-lg font-bold text-warm-charcoal">
                {t("title")}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-warm-grey hover:bg-warm-grey/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <p className="mt-12 text-center text-warm-grey">{t("empty")}</p>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.projectId}
                      className="flex gap-4 rounded-lg bg-white p-3 shadow-sm"
                    >
                      {item.imageUrl && (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
                          <Image
                            src={item.imageUrl}
                            alt={item.projectName[locale as "en" | "zh"]}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-warm-charcoal">
                          {item.projectName[locale as "en" | "zh"]}
                        </p>
                        {item.styleName && (
                          <p className="text-xs text-warm-grey">
                            {item.styleName[locale as "en" | "zh"]}
                          </p>
                        )}
                        {item.date && (
                          <p className="text-xs text-warm-grey">
                            {item.date} · {item.people} {t("people")}
                          </p>
                        )}
                        {item.price && (
                          <p className="mt-1 text-xs text-caramel">{item.price}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.projectId)}
                        className="self-start text-warm-grey hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>


            {items.length > 0 && (
              <div className="border-t border-warm-grey/10 px-6 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
                <Link
                  href="/cart"
                  onClick={() => setIsOpen(false)}
                  className="block w-full rounded-full bg-caramel py-3 text-center text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {t("submit")}
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
