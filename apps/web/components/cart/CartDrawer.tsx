"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { X, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useCart } from "@/lib/cart/context";

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
    ),
  );
}

export default function CartDrawer() {
  const { items, removeItem, isOpen, setIsOpen } = useCart();
  const locale = useLocale();
  const t = useTranslations("cart");
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const focusableElements = dialog ? getFocusableElements(dialog) : [];
    (focusableElements[0] ?? dialog)?.focus();

    const modalRoot = modalRootRef.current;
    const hiddenSiblings = Array.from(document.body.children).filter(
      (element) => element !== modalRoot,
    );
    const previousStates = hiddenSiblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.hasAttribute("inert"),
    }));
    for (const { element } of previousStates) {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    }

    const keepFocusInDialog = (event: FocusEvent) => {
      if (
        dialog &&
        event.target instanceof Node &&
        !dialog.contains(event.target)
      ) {
        (getFocusableElements(dialog)[0] ?? dialog).focus();
      }
    };
    document.addEventListener("focusin", keepFocusInDialog);

    return () => {
      document.removeEventListener("focusin", keepFocusInDialog);
      for (const { element, ariaHidden, inert } of previousStates) {
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
        if (inert) element.setAttribute("inert", "");
        else element.removeAttribute("inert");
      }
      openerRef.current?.focus();
    };
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key !== "Tab") return;
    const focusableElements = getFocusableElements(event.currentTarget);
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === firstElement ||
        !event.currentTarget.contains(document.activeElement))
    ) {
      event.preventDefault();
      lastElement?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === lastElement ||
        !event.currentTarget.contains(document.activeElement))
    ) {
      event.preventDefault();
      firstElement?.focus();
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    isOpen ? (
      <div ref={modalRootRef} className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "tween", duration: 0.3 }}
            aria-labelledby={titleId}
            aria-modal="true"
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-xl"
            onKeyDown={handleKeyDown}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-warm-grey/10 px-6 py-4">
              <h2
                id={titleId}
                className="font-serif text-lg font-bold text-warm-charcoal"
              >
                {t("title")}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t("close")}
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
                          <p className="mt-1 text-xs text-caramel">
                            {item.price}
                          </p>
                        )}
                      </div>
                      <button
                        aria-label={`${t("removeItem")} ${item.projectName[locale as "en" | "zh"]}`}
                        type="button"
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
              <div
                className="border-t border-warm-grey/10 px-6 py-4"
                style={{
                  paddingBottom:
                    "calc(1rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                <Link
                  href="/cart"
                  onClick={() => setIsOpen(false)}
                  className="block w-full rounded-full bg-caramel py-3 text-center text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {t("goToCart")}
                </Link>
              </div>
            )}
          </motion.div>
      </div>
    ) : null,
    document.body,
  );
}
