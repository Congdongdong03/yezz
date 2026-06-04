"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart/context";

export default function CartIcon() {
  const { items, hydrated, toggle, highlightCart } = useCart();
  const count = hydrated ? items.length : 0;

  return (
    <button
      onClick={toggle}
      className={`relative rounded-full p-2 text-warm-charcoal transition-colors hover:bg-warm-grey/10 ${
        highlightCart ? "ring-2 ring-caramel ring-offset-2" : ""
      }`}
      aria-label="Open cart"
    >
      <ShoppingBag className="h-5 w-5" />
      {count > 0 && (
        <span
          className={`absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-caramel text-[10px] font-bold text-white ${
            highlightCart ? "animate-pulse" : ""
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
