"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import { submitCart } from "@/lib/actions/cart";

export default function CartPage() {
  const locale = useLocale();
  const t = useTranslations("cart");
  const { items, clearItems, removeItem } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wechat, setWechat] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;

  if (items.length === 0 && status !== "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <p className="text-warm-grey">{t("empty")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setStatus("submitting");
    setFieldErrors({});

    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("wechat", wechat);
    formData.append("email", email);
    formData.append("message", message);
    formData.append("items", JSON.stringify(items));

    const result = await submitCart(formData);
    if (result.success) {
      setStatus("success");
      clearItems();
    } else {
      setStatus("error");
      if (result.errors) {
        setFieldErrors(result.errors);
      }
    }
  };

  const fieldError = (key: string) => fieldErrors[key]?.[0];

  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
            {t("thankYou")}
          </h2>
          <p className="mt-2 text-warm-grey">{t("confirmMessage")}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream py-12">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="font-serif text-2xl font-bold text-warm-charcoal">
          {t("checkoutTitle")}
        </h1>

        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div
              key={item.projectId}
              className="flex gap-4 rounded-xl bg-white p-4 shadow-sm"
            >
              {item.imageUrl && (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={item.imageUrl}
                    alt={item.projectName[locale as "en" | "zh"]}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-warm-charcoal">
                  {item.projectName[locale as "en" | "zh"]}
                </p>
                {item.styleName && (
                  <p className="text-sm text-warm-grey">
                    {item.styleName[locale as "en" | "zh"]}
                  </p>
                )}
                {item.date && (
                  <p className="text-sm text-warm-grey">
                    {item.date} · {item.people} {t("people")}
                  </p>
                )}
                {item.price && <p className="text-sm text-caramel">{item.price}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.projectId)}
                className="self-start text-warm-grey hover:text-red-500"
                aria-label={t("removeItem")}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor={fieldId("name")} className="block text-sm font-medium text-warm-charcoal">
              {t("name")} *
            </label>
            <input
              id={fieldId("name")}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
            {fieldError("name") && (
              <p className="mt-1 text-sm text-red-500">{fieldError("name")}</p>
            )}
          </div>
          <div>
            <label htmlFor={fieldId("phone")} className="block text-sm font-medium text-warm-charcoal">
              {t("phone")} *
            </label>
            <input
              id={fieldId("phone")}
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
            {fieldError("phone") && (
              <p className="mt-1 text-sm text-red-500">{fieldError("phone")}</p>
            )}
          </div>
          <div>
            <label htmlFor={fieldId("wechat")} className="block text-sm font-medium text-warm-charcoal">
              {t("wechat")}
            </label>
            <input
              id={fieldId("wechat")}
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
            {fieldError("wechat") && (
              <p className="mt-1 text-sm text-red-500">{fieldError("wechat")}</p>
            )}
          </div>
          <div>
            <label htmlFor={fieldId("email")} className="block text-sm font-medium text-warm-charcoal">
              {t("email")}
            </label>
            <input
              id={fieldId("email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
            {fieldError("email") && (
              <p className="mt-1 text-sm text-red-500">{fieldError("email")}</p>
            )}
          </div>
          <div>
            <label htmlFor={fieldId("message")} className="block text-sm font-medium text-warm-charcoal">
              {t("note")}
            </label>
            <textarea
              id={fieldId("message")}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
            {fieldError("message") && (
              <p className="mt-1 text-sm text-red-500">{fieldError("message")}</p>
            )}
          </div>

          {(fieldError("server") || fieldError("items") || status === "error") && (
            <p className="text-sm text-red-500" role="alert">
              {fieldError("server") ?? fieldError("items") ?? t("error")}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-full bg-caramel py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {status === "submitting" ? t("submitting") : t("confirmSubmit")}
          </button>
        </form>
      </div>
    </div>
  );
}
