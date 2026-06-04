"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart/context";

export default function CartToast() {
  const t = useTranslations("cart");
  const { notice, clearNotice } = useCart();

  if (!notice) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-warm-charcoal px-5 py-2.5 text-sm text-cream shadow-lg"
    >
      <button type="button" onClick={clearNotice} className="text-cream">
        {t("alreadyInCart")}
      </button>
    </div>
  );
}
