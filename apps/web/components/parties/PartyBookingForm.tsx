"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { CURRENT_BOOKING_POLICY_VERSION } from "@/lib/booking/policy-version";
import {
  createBookingAttempt,
  submitPartyBooking,
} from "@/lib/actions/booking";
import {
  getPartyAvailability,
  type PartyAvailabilitySlot,
} from "@/lib/api/availability";

export type PartyBookingFormParty = {
  id: string;
  name: { en: string; zh: string };
  minPeople: number;
  maxPeople: number;
  priceIndicator?: string;
  guestDurationMinutes: 90 | 150;
  setupMinutes: 30;
  cleanupMinutes: 30;
  venueFeeCents: 9500 | 14500;
  minSpendPerPersonCents: 4500;
  minParents: 1;
  maxParents: 2;
};

type PartyBookingFormProps = {
  party: PartyBookingFormParty;
};

type FormErrors = Record<string, string[] | undefined>;

const PROJECTS = [
  ["Air-dry cream piping", "projectCream"],
  ["Melty bead craft", "projectMelty"],
  ["Paint clay figurine", "projectClay"],
  ["Beading", "projectBeading"],
] as const;

const BYO_FIELDS = [
  ["byoCake", "byoCake"],
  ["byoDrinks", "byoDrinks"],
  ["byoFood", "byoFood"],
  ["byoSnacks", "byoSnacks"],
] as const;

export default function PartyBookingForm({ party }: PartyBookingFormProps) {
  const locale = useLocale() === "zh" ? "zh" : "en";
  const t = useTranslations("partyBookingForm");
  const id = useId();
  const requestSequence = useRef(0);
  const [participants, setParticipants] = useState(4);
  const [parents, setParents] = useState(1);
  const [birthdayAge, setBirthdayAge] = useState(5);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<PartyAvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] =
    useState<PartyAvailabilitySlot | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [attempt] = useState(createBookingAttempt);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const fieldId = (name: string) => `${id}-${name}`;
  const errorId = (name: string) => `${id}-${name}-error`;
  const serverErrorId = `${id}-server-error`;
  const localizedName = party.name[locale];

  const loadAvailability = useCallback(async (requestedDate: string) => {
    if (!requestedDate) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    const sequence = ++requestSequence.current;
    setLoadingSlots(true);
    setAvailabilityError(false);
    setSelectedSlot(null);
    try {
      const candidates = await getPartyAvailability({
        date: requestedDate,
        guestDurationMinutes: party.guestDurationMinutes,
      });
      if (sequence !== requestSequence.current) return;
      setSlots(candidates);
    } catch {
      if (sequence !== requestSequence.current) return;
      setSlots([]);
      setAvailabilityError(true);
    } finally {
      if (sequence === requestSequence.current) setLoadingSlots(false);
    }
  }, [party.guestDurationMinutes]);

  const toggleProject = (project: string, checked: boolean) => {
    setProjects((current) =>
      checked
        ? [...new Set([...current, project])]
        : current.filter((value) => value !== project),
    );
    setErrors((current) => ({ ...current, projectInterests: undefined }));
  };

  const validate = (form: HTMLFormElement): FormErrors => {
    const data = new FormData(form);
    const next: FormErrors = {};
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const birthdayName = String(data.get("birthdayChildName") ?? "").trim();

    if (!name) next.name = [t("nameRequired")];
    if (!phone) next.phone = [t("phoneRequired")];
    if (!email) {
      next.email = [t("emailRequired")];
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = [t("emailInvalid")];
    }
    if (!birthdayName) {
      next.birthdayChildName = [t("birthdayNameRequired")];
    }
    if (participants < 4 || participants > 8) {
      next.participantCount = [t("peopleRangeError")];
    }
    if (parents < 1 || parents > 2) {
      next.parentCount = [t("parentsRangeError")];
    }
    if (birthdayAge < 5) {
      next.birthdayChildAge = [t("birthdayAgeError")];
    }
    if (projects.length === 0) {
      next.projectInterests = [t("projectRequired")];
    }
    if (!date) next.desiredDate = [t("selectDate")];
    if (!selectedSlot) next.desiredStartTime = [t("selectSlot")];
    if (!policyAccepted) {
      next.policyAccepted = [t("policyRequired")];
    }
    return next;
  };

  const focusFirstError = (next: FormErrors) => {
    const first = [
      "name",
      "phone",
      "email",
      "birthdayChildName",
      "birthdayChildAge",
      "participantCount",
      "parentCount",
      "projectInterests",
      "desiredDate",
      "policyAccepted",
    ].find((name) => next[name]?.[0]);
    if (!first) return;
    const target =
      first === "projectInterests"
        ? document.getElementById(fieldId("project-0"))
        : document.getElementById(fieldId(first));
    target?.focus();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const localErrors = validate(form);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      queueMicrotask(() => focusFirstError(localErrors));
      return;
    }

    setSubmitting(true);
    setErrors({});
    const formData = new FormData(form);
    formData.set("partyPackageId", party.id);
    formData.set("participantCount", String(participants));
    formData.set("parentCount", String(parents));
    formData.set("birthdayChildAge", String(birthdayAge));
    formData.set("desiredDate", date);
    formData.set("desiredStartTime", selectedSlot!.startTime);
    formData.set("projectInterests", JSON.stringify(projects));
    for (const [name] of BYO_FIELDS) {
      formData.set(name, formData.has(name) ? "true" : "false");
    }
    formData.set(
      "cakeCuttingRequested",
      formData.has("cakeCuttingRequested") ? "true" : "false",
    );
    formData.set("locale", locale);
    formData.set("policyVersion", CURRENT_BOOKING_POLICY_VERSION);
    formData.set("policyAccepted", "true");

    const result = await submitPartyBooking(formData, attempt);
    if (result.success) {
      setSuccess(true);
    } else {
      setErrors(result.errors as FormErrors);
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <section
        className="rounded-3xl border border-sage/45 bg-sage/15 p-6 sm:p-8"
        role="status"
      >
        <h3 className="font-serif text-2xl font-semibold text-warm-charcoal">
          {t("successTitle")}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-warm-charcoal">
          {t("successBody")}
        </p>
      </section>
    );
  }

  const inputClass =
    "mt-2 min-h-11 w-full rounded-xl border border-warm-grey/25 bg-white px-3 text-base text-warm-charcoal outline-none transition focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25";
  const labelClass = "text-sm font-semibold text-warm-charcoal";

  const renderTextField = (
    name:
      | "name"
      | "phone"
      | "email"
      | "birthdayChildName",
    type: "text" | "tel" | "email" = "text",
  ) => {
    const error = errors[name]?.[0];
    return (
      <div>
        <label className={labelClass} htmlFor={fieldId(name)}>
          {t(name)} *
        </label>
        <input
          aria-describedby={error ? errorId(name) : undefined}
          aria-invalid={Boolean(error)}
          className={inputClass}
          id={fieldId(name)}
          name={name}
          type={type}
        />
        {error && (
          <p className="mt-1 text-sm text-red-700" id={errorId(name)} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      aria-describedby={errors.server?.[0] ? serverErrorId : undefined}
      aria-label={`${t("title")}: ${localizedName}`}
      className="space-y-6 rounded-3xl border border-caramel/20 bg-cream/65 p-5 shadow-sm sm:p-7"
      noValidate
      onSubmit={onSubmit}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-caramel">
          {localizedName}
        </p>
        <h3 className="mt-2 font-serif text-2xl font-semibold text-warm-charcoal">
          {t("title")}
        </h3>
        <p className="mt-2 text-sm font-semibold text-warm-charcoal">
          A${party.venueFeeCents / 100} {t("currency")} ·{" "}
          {party.guestDurationMinutes === 90 ? "1.5" : "2.5"}{" "}
          {t("guestHours")}
        </p>
        <p className="mt-3 rounded-2xl border border-lavender/55 bg-lavender/15 px-4 py-3 text-sm leading-6 text-warm-charcoal">
          {t("requestOnly")}
        </p>
        <p className="mt-3 rounded-2xl border border-sage/40 bg-sage/15 px-4 py-3 text-sm leading-6 text-warm-charcoal">
          {t("manualPayment")}
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5">
        <h4 className="font-serif text-lg font-semibold text-warm-charcoal">
          {t("celebrationDetails")}
        </h4>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {renderTextField("name")}
          {renderTextField("phone", "tel")}
          {renderTextField("email", "email")}
          {renderTextField("birthdayChildName")}
          <div>
            <label className={labelClass} htmlFor={fieldId("birthdayChildAge")}>
              {t("birthdayChildAge")} *
            </label>
            <input
              aria-describedby={
                errors.birthdayChildAge?.[0]
                  ? errorId("birthdayChildAge")
                  : undefined
              }
              aria-invalid={Boolean(errors.birthdayChildAge)}
              className={inputClass}
              id={fieldId("birthdayChildAge")}
              min={5}
              name="birthdayChildAge"
              onChange={(event) => {
                setBirthdayAge(Number(event.target.value));
                setErrors((current) => ({
                  ...current,
                  birthdayChildAge: undefined,
                }));
              }}
              type="number"
              value={birthdayAge}
            />
            {errors.birthdayChildAge?.[0] && (
              <p
                className="mt-1 text-sm text-red-700"
                id={errorId("birthdayChildAge")}
                role="alert"
              >
                {errors.birthdayChildAge[0]}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor={fieldId("participantCount")}>
              {t("participants")} *
            </label>
            <input
              aria-describedby={
                errors.participantCount?.[0]
                  ? errorId("participantCount")
                  : undefined
              }
              aria-invalid={Boolean(errors.participantCount)}
              className={inputClass}
              id={fieldId("participantCount")}
              max={8}
              min={4}
              name="participantCount"
              onChange={(event) => {
                setParticipants(Number(event.target.value));
                setErrors((current) => ({
                  ...current,
                  participantCount: undefined,
                }));
              }}
              type="number"
              value={participants}
            />
            {errors.participantCount?.[0] && (
              <p
                className="mt-1 text-sm text-red-700"
                id={errorId("participantCount")}
                role="alert"
              >
                {errors.participantCount[0]}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor={fieldId("parentCount")}>
              {t("parents")} *
            </label>
            <input
              aria-describedby={
                errors.parentCount?.[0] ? errorId("parentCount") : undefined
              }
              aria-invalid={Boolean(errors.parentCount)}
              className={inputClass}
              id={fieldId("parentCount")}
              max={2}
              min={1}
              name="parentCount"
              onChange={(event) => {
                setParents(Number(event.target.value));
                setErrors((current) => ({
                  ...current,
                  parentCount: undefined,
                }));
              }}
              type="number"
              value={parents}
            />
            {errors.parentCount?.[0] && (
              <p
                className="mt-1 text-sm text-red-700"
                id={errorId("parentCount")}
                role="alert"
              >
                {errors.parentCount[0]}
              </p>
            )}
          </div>
        </div>
      </section>

      <fieldset
        aria-describedby={
          errors.projectInterests?.[0]
            ? errorId("projectInterests")
            : undefined
        }
        className="rounded-2xl bg-white p-5"
      >
        <legend className="font-serif text-lg font-semibold text-warm-charcoal">
          {t("projects")} *
        </legend>
        <p className="mt-2 text-sm leading-6 text-warm-grey">
          {t("projectSpend")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROJECTS.map(([value, label], index) => (
            <label
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-warm-grey/20 bg-cream/40 px-4 py-3 text-sm font-medium focus-within:ring-2 focus-within:ring-caramel/30"
              key={value}
              htmlFor={fieldId(`project-${index}`)}
            >
              <input
                checked={projects.includes(value)}
                className="h-5 w-5 accent-caramel"
                id={fieldId(`project-${index}`)}
                name="projectInterests"
                onChange={(event) => toggleProject(value, event.target.checked)}
                type="checkbox"
                value={value}
              />
              {t(label)}
            </label>
          ))}
        </div>
        {errors.projectInterests?.[0] && (
          <p
            className="mt-2 text-sm text-red-700"
            id={errorId("projectInterests")}
            role="alert"
          >
            {errors.projectInterests[0]}
          </p>
        )}
      </fieldset>

      <section className="rounded-2xl bg-white p-5">
        <h4 className="font-serif text-lg font-semibold text-warm-charcoal">
          {t("chooseSchedule")}
        </h4>
        <p className="mt-2 text-sm leading-6 text-warm-grey">
          {t("scheduleHelp")}
        </p>
        <label className={`${labelClass} mt-4 block`} htmlFor={fieldId("desiredDate")}>
          {t("desiredDate")} *
        </label>
        <input
          aria-describedby={
            errors.desiredDate?.[0] ? errorId("desiredDate") : undefined
          }
          aria-invalid={Boolean(errors.desiredDate)}
          className={inputClass}
          id={fieldId("desiredDate")}
          name="desiredDate"
          onChange={(event) => {
            const nextDate = event.target.value;
            setDate(nextDate);
            setErrors((current) => ({
              ...current,
              desiredDate: undefined,
              desiredStartTime: undefined,
            }));
            void loadAvailability(nextDate);
          }}
          type="date"
          value={date}
        />
        {errors.desiredDate?.[0] && (
          <p
            className="mt-1 text-sm text-red-700"
            id={errorId("desiredDate")}
            role="alert"
          >
            {errors.desiredDate[0]}
          </p>
        )}

        <div
          aria-busy={loadingSlots}
          aria-describedby={
            errors.desiredStartTime?.[0]
              ? errorId("desiredStartTime")
              : undefined
          }
          aria-label={t("guestTime")}
          className="mt-4 grid gap-2 sm:grid-cols-2"
          role="group"
        >
          {loadingSlots ? (
            <p className="text-sm text-warm-grey">{t("checking")}</p>
          ) : availabilityError ? (
            <div>
              <p className="text-sm text-red-700" role="alert">
                {t("availabilityError")}
              </p>
              <button
                className="mt-2 min-h-11 rounded-full border border-caramel px-4 text-sm font-semibold text-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel"
                onClick={() => void loadAvailability(date)}
                type="button"
              >
                {t("retryAvailability")}
              </button>
            </div>
          ) : date && slots.length === 0 ? (
            <p className="text-sm text-warm-grey">{t("noTimes")}</p>
          ) : (
            slots.map((slot) => {
              const selected = selectedSlot?.startTime === slot.startTime;
              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel ${
                    selected
                      ? "border-caramel bg-caramel text-white"
                      : "border-caramel/35 bg-cream/50 text-warm-charcoal hover:border-caramel"
                  }`}
                  key={`${slot.date}-${slot.startTime}`}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setErrors((current) => ({
                      ...current,
                      desiredStartTime: undefined,
                    }));
                  }}
                  type="button"
                >
                  {t("requestTime", {
                    start: slot.startTime,
                    end: slot.endTime,
                  })}
                </button>
              );
            })
          )}
        </div>
        {errors.desiredStartTime?.[0] && (
          <p
            className="mt-2 text-sm text-red-700"
            id={errorId("desiredStartTime")}
            role="alert"
          >
            {errors.desiredStartTime[0]}
          </p>
        )}
      </section>

      <fieldset className="rounded-2xl bg-white p-5">
        <legend className="font-serif text-lg font-semibold text-warm-charcoal">
          {t("byoTitle")}
        </legend>
        <p className="mt-2 text-sm leading-6 text-warm-grey">{t("byoHelp")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BYO_FIELDS.map(([name, label]) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-warm-grey/20 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-caramel/30"
              key={name}
            >
              <input
                className="h-5 w-5 accent-caramel"
                name={name}
                type="checkbox"
                value="true"
              />
              {t(label)}
            </label>
          ))}
        </div>
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-caramel/25 bg-caramel/5 px-4 py-3 text-sm font-medium focus-within:ring-2 focus-within:ring-caramel/30">
          <input
            className="h-5 w-5 accent-caramel"
            name="cakeCuttingRequested"
            type="checkbox"
            value="true"
          />
          {t("cakeCutting")}
        </label>
        <p className="mt-3 text-xs leading-5 text-warm-grey">
          {t("additionalCharges")}
        </p>
      </fieldset>

      <section className="rounded-2xl bg-white p-5">
        <label className={labelClass} htmlFor={fieldId("specialRequirements")}>
          {t("specialRequirements")}
        </label>
        <textarea
          className={`${inputClass} py-3`}
          id={fieldId("specialRequirements")}
          name="specialRequirements"
          rows={4}
        />
        <p className="mt-5 rounded-xl border border-lavender/50 bg-lavender/10 px-4 py-3 text-sm leading-6 text-warm-charcoal">
          {t("policySummary")}
        </p>
        <label
          className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-warm-grey/20 p-4 text-sm font-medium leading-6 focus-within:ring-2 focus-within:ring-caramel/30"
          htmlFor={fieldId("policyAccepted")}
        >
          <input
            aria-describedby={
              errors.policyAccepted?.[0]
                ? errorId("policyAccepted")
                : undefined
            }
            aria-invalid={Boolean(errors.policyAccepted)}
            checked={policyAccepted}
            className="mt-1 h-5 w-5 shrink-0 accent-caramel"
            id={fieldId("policyAccepted")}
            name="policyAccepted"
            onChange={(event) => {
              setPolicyAccepted(event.target.checked);
              setErrors((current) => ({
                ...current,
                policyAccepted: undefined,
              }));
            }}
            type="checkbox"
            value="true"
          />
          <span>{t("policyConsent")}</span>
        </label>
        {errors.policyAccepted?.[0] && (
          <p
            className="mt-2 text-sm text-red-700"
            id={errorId("policyAccepted")}
            role="alert"
          >
            {errors.policyAccepted[0]}
          </p>
        )}
      </section>

      {errors.server?.[0] && (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
          id={serverErrorId}
          role="alert"
        >
          {errors.server[0]}
        </p>
      )}

      <button
        className="min-h-12 w-full rounded-full bg-caramel px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
