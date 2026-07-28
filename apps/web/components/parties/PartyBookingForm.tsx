"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import BookingCalendar from "@/components/book/BookingCalendar";
import type { TimeSlotOption } from "@/lib/api/time-slots";
import {
  createBookingAttempt,
  submitPartyBooking,
} from "@/lib/actions/booking";

export type PartyBookingFormParty = {
  id: string;
  name: { en: string; zh: string };
  minPeople: number;
  maxPeople: number;
  priceIndicator?: string;
};

type PartyBookingFormProps = {
  party: PartyBookingFormParty;
};

export default function PartyBookingForm({ party }: PartyBookingFormProps) {
  const locale = useLocale();
  const t = useTranslations("partyBookingForm");
  const id = useId();
  const [people, setPeople] = useState(party.minPeople);
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotOption | null>(null);
  const [attempt] = useState(createBookingAttempt);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const fieldId = (name: string) => `${id}-${name}`;
  const errorId = (name: string) => `${id}-${name}-error`;
  const serverErrorId = `${id}-server-error`;
  const localizedName = party.name[locale === "zh" ? "zh" : "en"];

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlot || !date) {
      setErrors({ server: [t("selectSlot")] });
      return;
    }
    setSubmitting(true);
    setErrors({});
    const formData = new FormData(event.currentTarget);
    formData.set("partyPackageId", party.id);
    formData.set("timeSlotId", selectedSlot.id);
    formData.set("preferredDate", date);
    formData.set("minPeople", String(party.minPeople));
    formData.set("maxPeople", String(party.maxPeople));
    formData.set("locale", locale);
    const result = await submitPartyBooking(formData, attempt);
    if (result.success) {
      setSuccess(true);
    } else {
      setErrors(result.errors as Record<string, string[] | undefined>);
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div
        className="rounded-2xl border border-sage/40 bg-sage/15 p-6"
        role="status"
      >
        <h3 className="font-serif text-xl font-semibold text-warm-charcoal">
          {t("successTitle")}
        </h3>
        <p className="mt-2 text-sm leading-6 text-warm-grey">
          {t("successBody")}
        </p>
      </div>
    );
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-warm-grey/25 bg-white px-3 py-2.5 text-sm text-warm-charcoal outline-none transition focus:border-caramel focus:ring-2 focus:ring-caramel/20";

  return (
    <form
      aria-describedby={errors.server?.[0] ? serverErrorId : undefined}
      aria-label={`${t("title")}: ${localizedName}`}
      className="space-y-5 rounded-2xl border border-caramel/20 bg-cream/60 p-5 sm:p-6"
      onSubmit={onSubmit}
    >
      <div>
        <h3 className="font-serif text-xl font-semibold text-warm-charcoal">
          {t("title")}
        </h3>
        <p className="mt-1 text-sm text-warm-grey">
          {localizedName} ·{" "}
          {t("peopleRange", {
            min: party.minPeople,
            max: party.maxPeople,
          })}
          {party.priceIndicator ? ` · ${party.priceIndicator}` : ""}
        </p>
      </div>

      <p className="rounded-xl border border-sage/30 bg-sage/15 px-4 py-3 text-sm leading-6 text-warm-charcoal">
        {t("manualPayment")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium text-warm-charcoal"
            htmlFor={fieldId("name")}
          >
            {t("name")} *
          </label>
          <input
            aria-describedby={errors.name?.[0] ? errorId("name") : undefined}
            aria-invalid={Boolean(errors.name)}
            className={inputClass}
            id={fieldId("name")}
            name="name"
            required
          />
          {errors.name?.[0] && (
            <p className="mt-1 text-sm text-red-700" id={errorId("name")}>
              {errors.name[0]}
            </p>
          )}
        </div>
        <div>
          <label
            className="text-sm font-medium text-warm-charcoal"
            htmlFor={fieldId("phone")}
          >
            {t("phone")} *
          </label>
          <input
            aria-describedby={errors.phone?.[0] ? errorId("phone") : undefined}
            aria-invalid={Boolean(errors.phone)}
            className={inputClass}
            id={fieldId("phone")}
            name="phone"
            required
            type="tel"
          />
          {errors.phone?.[0] && (
            <p className="mt-1 text-sm text-red-700" id={errorId("phone")}>
              {errors.phone[0]}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium text-warm-charcoal"
            htmlFor={fieldId("email")}
          >
            {t("email")} *
          </label>
          <input
            aria-describedby={errors.email?.[0] ? errorId("email") : undefined}
            aria-invalid={Boolean(errors.email)}
            className={inputClass}
            id={fieldId("email")}
            name="email"
            required
            type="email"
          />
          {errors.email?.[0] && (
            <p className="mt-1 text-sm text-red-700" id={errorId("email")}>
              {errors.email[0]}
            </p>
          )}
        </div>
        <div>
          <label
            className="text-sm font-medium text-warm-charcoal"
            htmlFor={fieldId("numberOfPeople")}
          >
            {t("people")} *
          </label>
          <input
            aria-describedby={
              errors.numberOfPeople?.[0] ? errorId("numberOfPeople") : undefined
            }
            aria-invalid={Boolean(errors.numberOfPeople)}
            className={inputClass}
            id={fieldId("numberOfPeople")}
            max={party.maxPeople}
            min={party.minPeople}
            name="numberOfPeople"
            onChange={(event) => {
              setPeople(Number.parseInt(event.target.value, 10) || 0);
              setSelectedSlot(null);
            }}
            required
            type="number"
            value={people}
          />
          {errors.numberOfPeople?.[0] && (
            <p
              className="mt-1 text-sm text-red-700"
              id={errorId("numberOfPeople")}
            >
              {errors.numberOfPeople[0]}
            </p>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-warm-charcoal">
          {t("chooseSchedule")} *
        </h4>
        <div className="mt-2 rounded-xl border border-warm-grey/15 bg-white p-4">
          <BookingCalendar
            categoryId={null}
            onDateChange={setDate}
            onSelectSlot={setSelectedSlot}
            people={people}
            selectedSlotId={selectedSlot?.id ?? null}
          />
        </div>
      </div>

      <div>
        <label
          className="text-sm font-medium text-warm-charcoal"
          htmlFor={fieldId("message")}
        >
          {t("message")}
        </label>
        <textarea
          className={inputClass}
          id={fieldId("message")}
          name="message"
          rows={3}
        />
      </div>

      {errors.server?.[0] && (
        <p
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          id={serverErrorId}
          role="alert"
        >
          {errors.server[0]}
        </p>
      )}

      <button
        className="w-full rounded-full bg-caramel px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
