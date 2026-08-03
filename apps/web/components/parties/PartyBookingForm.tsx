"use client"

import { useCallback, useId, useRef, useState, type FormEvent } from "react"
import { useLocale, useTranslations } from "next-intl"
import { CURRENT_BOOKING_POLICY_VERSION } from "@/lib/booking/policy-version"
import { createBookingAttempt, submitPartyBooking } from "@/lib/actions/booking"
import {
  getPartyAvailability,
  type PartyAvailabilitySlot,
} from "@/lib/api/availability"
import PhotoConsentField from "@/components/book/PhotoConsentField"
import {
  CURRENT_PHOTO_CONSENT_VERSION,
  type PhotoConsentDecision,
} from "@/lib/booking/photo-consent"

export type PartyBookingFormParty = {
  id: string
  name: { en: string; zh: string }
  minPeople: number
  maxPeople: number
  priceIndicator?: string
  guestDurationMinutes: 90 | 150
  setupMinutes: 30
  cleanupMinutes: 30
  venueFeeCents: 9500 | 14500
  minSpendPerPersonCents: 4500
  minParents: 1
  maxParents: 2
}

type PartyBookingFormProps = {
  party: PartyBookingFormParty
}

type FormErrors = Record<string, string[] | undefined>
type PartyStep = 1 | 2 | 3
type ContactDetails = {
  name: string
  phone: string
  email: string
  birthdayChildName: string
}

const PROJECTS = [
  ["Air-dry cream piping", "projectCream"],
  ["Melty bead craft", "projectMelty"],
  ["Paint clay figurine", "projectClay"],
  ["Beading", "projectBeading"],
] as const

const NOT_SURE_PROJECT = "Not sure yet"

const BYO_FIELDS = [
  ["byoCake", "byoCake"],
  ["byoDrinks", "byoDrinks"],
  ["byoFood", "byoFood"],
  ["byoSnacks", "byoSnacks"],
] as const

type ByoField = (typeof BYO_FIELDS)[number][0]

const EMPTY_CONTACT: ContactDetails = {
  name: "",
  phone: "",
  email: "",
  birthdayChildName: "",
}

const EMPTY_BYO: Record<ByoField, boolean> = {
  byoCake: false,
  byoDrinks: false,
  byoFood: false,
  byoSnacks: false,
}

const STEP_ONE_FIELDS = new Set([
  "name",
  "phone",
  "email",
  "birthdayChildName",
  "birthdayChildAge",
  "participantCount",
  "parentCount",
])
const STEP_TWO_FIELDS = new Set([
  "projectInterests",
  "desiredDate",
  "desiredStartTime",
])

export default function PartyBookingForm({ party }: PartyBookingFormProps) {
  const locale = useLocale() === "zh" ? "zh" : "en"
  const t = useTranslations("partyBookingForm")
  const id = useId()
  const requestSequence = useRef(0)
  const [currentStep, setCurrentStep] = useState<PartyStep>(1)
  const [contact, setContact] = useState<ContactDetails>(EMPTY_CONTACT)
  const [participants, setParticipants] = useState(4)
  const [parents, setParents] = useState(1)
  const [birthdayAge, setBirthdayAge] = useState(5)
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<PartyAvailabilitySlot[]>([])
  const [selectedSlot, setSelectedSlot] =
    useState<PartyAvailabilitySlot | null>(null)
  const [projects, setProjects] = useState<string[]>([])
  const [byo, setByo] = useState<Record<ByoField, boolean>>(EMPTY_BYO)
  const [cakeCuttingRequested, setCakeCuttingRequested] = useState(false)
  const [specialRequirements, setSpecialRequirements] = useState("")
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [photoConsentDecision, setPhotoConsentDecision] =
    useState<PhotoConsentDecision>("declined")
  const [photoConsentSignerName, setPhotoConsentSignerName] = useState("")
  const [attempt] = useState(createBookingAttempt)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [availabilityError, setAvailabilityError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const fieldId = (name: string) => `${id}-${name}`
  const errorId = (name: string) => `${id}-${name}-error`
  const serverErrorId = `${id}-server-error`
  const localizedName = party.name[locale]

  const focusAfterRender = (name: string) => {
    const targetName =
      name === "projectInterests"
        ? "project-0"
        : name === "desiredStartTime"
          ? "desiredDate"
          : name
    window.setTimeout(() => {
      document.getElementById(`${id}-${targetName}`)?.focus()
    }, 0)
  }

  const loadAvailability = useCallback(
    async (requestedDate: string) => {
      if (!requestedDate) {
        setSlots([])
        setSelectedSlot(null)
        return
      }
      const sequence = ++requestSequence.current
      setLoadingSlots(true)
      setAvailabilityError(false)
      setSelectedSlot(null)
      try {
        const candidates = await getPartyAvailability({
          date: requestedDate,
          guestDurationMinutes: party.guestDurationMinutes,
        })
        if (sequence !== requestSequence.current) return
        setSlots(candidates)
      } catch {
        if (sequence !== requestSequence.current) return
        setSlots([])
        setAvailabilityError(true)
      } finally {
        if (sequence === requestSequence.current) setLoadingSlots(false)
      }
    },
    [party.guestDurationMinutes]
  )

  const clearError = (name: string) => {
    setErrors((current) => ({
      ...current,
      [name]: undefined,
      server: undefined,
    }))
  }

  const updateContact = (name: keyof ContactDetails, value: string) => {
    setContact((current) => ({ ...current, [name]: value }))
    clearError(name)
  }

  const toggleProject = (project: string, checked: boolean) => {
    setProjects((current) => {
      if (!checked) return current.filter((value) => value !== project)
      if (project === NOT_SURE_PROJECT) return [NOT_SURE_PROJECT]
      return [
        ...new Set([
          ...current.filter((value) => value !== NOT_SURE_PROJECT),
          project,
        ]),
      ]
    })
    clearError("projectInterests")
  }

  const validatePeople = (): FormErrors => {
    const next: FormErrors = {}
    if (!contact.name.trim()) next.name = [t("nameRequired")]
    if (!contact.phone.trim()) next.phone = [t("phoneRequired")]
    if (!contact.email.trim()) {
      next.email = [t("emailRequired")]
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
      next.email = [t("emailInvalid")]
    }
    if (!contact.birthdayChildName.trim()) {
      next.birthdayChildName = [t("birthdayNameRequired")]
    }
    if (participants < 4 || participants > 8) {
      next.participantCount = [t("peopleRangeError")]
    }
    if (parents < 1 || parents > 2) {
      next.parentCount = [t("parentsRangeError")]
    }
    if (birthdayAge < 5) {
      next.birthdayChildAge = [t("birthdayAgeError")]
    }
    return next
  }

  const validatePlan = (): FormErrors => {
    const next: FormErrors = {}
    if (projects.length === 0) {
      next.projectInterests = [t("projectRequired")]
    }
    if (!date) next.desiredDate = [t("selectDate")]
    if (!selectedSlot) next.desiredStartTime = [t("selectSlot")]
    return next
  }

  const validateExtras = (): FormErrors => {
    const next: FormErrors = {}
    if (!policyAccepted) {
      next.policyAccepted = [t("policyRequired")]
    }
    if (
      photoConsentDecision !== "declined" &&
      photoConsentSignerName.trim().length < 2
    ) {
      next.photoConsentSignerName = [
        locale === "zh"
          ? "请填写同意授权人的全名"
          : "Enter the consenting adult or guardian’s full name",
      ]
    }
    return next
  }

  const firstError = (next: FormErrors) =>
    [
      "name",
      "phone",
      "email",
      "birthdayChildName",
      "birthdayChildAge",
      "participantCount",
      "parentCount",
      "projectInterests",
      "desiredDate",
      "desiredStartTime",
      "photoConsentSignerName",
      "policyAccepted",
    ].find((name) => next[name]?.[0])

  const stepForErrors = (next: FormErrors): PartyStep => {
    const names = Object.keys(next).filter((name) => next[name]?.[0])
    if (names.some((name) => STEP_ONE_FIELDS.has(name))) return 1
    if (names.some((name) => STEP_TWO_FIELDS.has(name))) return 2
    return 3
  }

  const showErrors = (next: FormErrors, step: PartyStep) => {
    setErrors(next)
    setCurrentStep(step)
    const first = firstError(next)
    if (first) focusAfterRender(first)
  }

  const goToNextStep = () => {
    const next = currentStep === 1 ? validatePeople() : validatePlan()
    if (Object.keys(next).length > 0) {
      showErrors(next, currentStep)
      return
    }
    setErrors({})
    setCurrentStep((current) => Math.min(3, current + 1) as PartyStep)
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const localErrors = {
      ...validatePeople(),
      ...validatePlan(),
      ...validateExtras(),
    }
    if (Object.keys(localErrors).length > 0) {
      showErrors(localErrors, stepForErrors(localErrors))
      return
    }

    setSubmitting(true)
    setErrors({})
    const formData = new FormData()
    formData.set("name", contact.name.trim())
    formData.set("phone", contact.phone.trim())
    formData.set("email", contact.email.trim())
    formData.set("birthdayChildName", contact.birthdayChildName.trim())
    formData.set("partyPackageId", party.id)
    formData.set("participantCount", String(participants))
    formData.set("parentCount", String(parents))
    formData.set("birthdayChildAge", String(birthdayAge))
    formData.set("desiredDate", date)
    formData.set("desiredStartTime", selectedSlot!.startTime)
    formData.set("projectInterests", JSON.stringify(projects))
    for (const [name] of BYO_FIELDS) {
      formData.set(name, String(byo[name]))
    }
    formData.set("cakeCuttingRequested", String(cakeCuttingRequested))
    formData.set("specialRequirements", specialRequirements.trim())
    formData.set("locale", locale)
    formData.set("policyVersion", CURRENT_BOOKING_POLICY_VERSION)
    formData.set("policyAccepted", "true")
    formData.set("photoConsentDecision", photoConsentDecision)
    formData.set("photoConsentSignerName", photoConsentSignerName.trim())
    formData.set("photoConsentVersion", CURRENT_PHOTO_CONSENT_VERSION)

    const result = await submitPartyBooking(formData, attempt)
    if (result.success) {
      setSuccess(true)
    } else {
      const serverErrors = result.errors as FormErrors
      setErrors(serverErrors)
      const first = firstError(serverErrors)
      if (first) {
        setCurrentStep(stepForErrors(serverErrors))
        focusAfterRender(first)
      }
    }
    setSubmitting(false)
  }

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
    )
  }

  const inputClass =
    "mt-2 min-h-11 w-full rounded-xl border border-warm-grey/25 bg-white px-3 text-base text-warm-charcoal outline-none transition focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25"
  const labelClass = "text-sm font-semibold text-warm-charcoal"

  const renderTextField = (
    name: keyof ContactDetails,
    type: "text" | "tel" | "email" = "text"
  ) => {
    const error = errors[name]?.[0]
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
          onChange={(event) => updateContact(name, event.target.value)}
          type={type}
          value={contact[name]}
        />
        {error && (
          <p
            className="mt-1 text-sm text-red-700"
            id={errorId(name)}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  const steps = [t("stepPeople"), t("stepPlan"), t("stepExtras")]

  return (
    <form
      aria-describedby={errors.server?.[0] ? serverErrorId : undefined}
      aria-label={`${t("title")}: ${localizedName}`}
      className="space-y-6 rounded-3xl border border-caramel/20 bg-cream/65 p-5 shadow-sm sm:p-7"
      noValidate
      onSubmit={onSubmit}
    >
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-caramel uppercase">
          {localizedName}
        </p>
        <h3 className="mt-2 font-serif text-2xl font-semibold text-warm-charcoal">
          {t("title")}
        </h3>
        <p className="mt-2 text-sm font-semibold text-warm-charcoal">
          A${party.venueFeeCents / 100} {t("currency")} ·{" "}
          {party.guestDurationMinutes === 90 ? "1.5" : "2.5"} {t("guestHours")}
        </p>
        <ol className="mt-5 grid grid-cols-3 gap-2 text-xs font-semibold text-warm-grey">
          {steps.map((label, index) => (
            <li
              aria-current={currentStep === index + 1 ? "step" : undefined}
              className={currentStep === index + 1 ? "text-warm-charcoal" : ""}
              key={label}
            >
              <span
                className={`mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full ${
                  currentStep === index + 1
                    ? "bg-caramel text-white"
                    : currentStep > index + 1
                      ? "bg-sage text-warm-charcoal"
                      : "bg-warm-grey/15"
                }`}
              >
                {index + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs font-semibold tracking-[0.12em] text-warm-grey uppercase">
          {t("stepOf", { current: currentStep, total: 3 })}
        </p>
      </div>

      {currentStep === 1 && (
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
              <label
                className={labelClass}
                htmlFor={fieldId("birthdayChildAge")}
              >
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
                  setBirthdayAge(Number(event.target.value))
                  clearError("birthdayChildAge")
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
              <label
                className={labelClass}
                htmlFor={fieldId("participantCount")}
              >
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
                  setParticipants(Number(event.target.value))
                  clearError("participantCount")
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
                  setParents(Number(event.target.value))
                  clearError("parentCount")
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
      )}

      {currentStep === 2 && (
        <>
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
              {[...PROJECTS, [NOT_SURE_PROJECT, "projectUnsure"] as const].map(
                ([value, label], index) => (
                  <label
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-warm-grey/20 bg-cream/40 px-4 py-3 text-sm font-medium focus-within:ring-2 focus-within:ring-caramel/30"
                    htmlFor={fieldId(`project-${index}`)}
                    key={value}
                  >
                    <input
                      checked={projects.includes(value)}
                      className="h-5 w-5 accent-caramel"
                      id={fieldId(`project-${index}`)}
                      name="projectInterests"
                      onChange={(event) =>
                        toggleProject(value, event.target.checked)
                      }
                      type="checkbox"
                      value={value}
                    />
                    {t(label)}
                  </label>
                )
              )}
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
            <label
              className={`${labelClass} mt-4 block`}
              htmlFor={fieldId("desiredDate")}
            >
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
                const nextDate = event.target.value
                setDate(nextDate)
                setSelectedSlot(null)
                setErrors((current) => ({
                  ...current,
                  desiredDate: undefined,
                  desiredStartTime: undefined,
                  server: undefined,
                }))
                void loadAvailability(nextDate)
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
                    className="mt-2 min-h-11 rounded-full border border-caramel px-4 text-sm font-semibold text-caramel focus-visible:ring-2 focus-visible:ring-caramel focus-visible:outline-none"
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
                  const selected = selectedSlot?.startTime === slot.startTime
                  return (
                    <button
                      aria-pressed={selected}
                      className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-caramel focus-visible:outline-none ${
                        selected
                          ? "border-caramel bg-caramel text-white"
                          : "border-caramel/35 bg-cream/50 text-warm-charcoal hover:border-caramel"
                      }`}
                      key={`${slot.date}-${slot.startTime}`}
                      onClick={() => {
                        setSelectedSlot(slot)
                        clearError("desiredStartTime")
                      }}
                      type="button"
                    >
                      {t("requestTime", {
                        start: slot.startTime,
                        end: slot.endTime,
                      })}
                    </button>
                  )
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
        </>
      )}

      {currentStep === 3 && (
        <>
          <fieldset className="rounded-2xl bg-white p-5">
            <legend className="font-serif text-lg font-semibold text-warm-charcoal">
              {t("byoTitle")}
            </legend>
            <p className="mt-2 text-sm leading-6 text-warm-grey">
              {t("byoHelp")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BYO_FIELDS.map(([name, label]) => (
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-warm-grey/20 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-caramel/30"
                  key={name}
                >
                  <input
                    checked={byo[name]}
                    className="h-5 w-5 accent-caramel"
                    name={name}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setByo((current) => ({ ...current, [name]: checked }))
                      if (name === "byoCake" && !checked) {
                        setCakeCuttingRequested(false)
                      }
                    }}
                    type="checkbox"
                    value="true"
                  />
                  {t(label)}
                </label>
              ))}
            </div>
            {byo.byoCake && (
              <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-caramel/25 bg-caramel/5 px-4 py-3 text-sm font-medium focus-within:ring-2 focus-within:ring-caramel/30">
                <input
                  checked={cakeCuttingRequested}
                  className="h-5 w-5 accent-caramel"
                  name="cakeCuttingRequested"
                  onChange={(event) =>
                    setCakeCuttingRequested(event.target.checked)
                  }
                  type="checkbox"
                  value="true"
                />
                {t("cakeCutting")}
              </label>
            )}
            <p className="mt-3 text-xs leading-5 text-warm-grey">
              {t("additionalCharges")}
            </p>
          </fieldset>

          <section className="rounded-2xl bg-white p-5">
            <label
              className={labelClass}
              htmlFor={fieldId("specialRequirements")}
            >
              {t("specialRequirements")}
            </label>
            <textarea
              className={`${inputClass} py-3`}
              id={fieldId("specialRequirements")}
              name="specialRequirements"
              onChange={(event) => setSpecialRequirements(event.target.value)}
              rows={4}
              value={specialRequirements}
            />
            <p className="mt-5 rounded-xl border border-lavender/50 bg-lavender/10 px-4 py-3 text-sm leading-6 text-warm-charcoal">
              {t("policySummary")}
            </p>
            <div className="mt-5">
              <PhotoConsentField
                decision={photoConsentDecision}
                error={errors.photoConsentSignerName?.[0]}
                locale={locale}
                onDecisionChange={(decision) => {
                  setPhotoConsentDecision(decision)
                  if (decision === "declined") setPhotoConsentSignerName("")
                  clearError("photoConsentSignerName")
                }}
                onSignerNameChange={(name) => {
                  setPhotoConsentSignerName(name)
                  clearError("photoConsentSignerName")
                }}
                signerName={photoConsentSignerName}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-warm-grey">
              {locale === "zh" ? "查看对应政策：" : "Read the policies:"}{" "}
              <a
                className="font-semibold text-caramel underline underline-offset-4"
                href={`/${locale}/party-terms`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {locale === "zh" ? "派对条款" : "Party Terms"}
              </a>
              {" · "}
              <a
                className="font-semibold text-caramel underline underline-offset-4"
                href={`/${locale}/cancellation-rescheduling`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {locale === "zh" ? "取消与改期" : "Cancellation & Rescheduling"}
              </a>
              {" · "}
              <a
                className="font-semibold text-caramel underline underline-offset-4"
                href={`/${locale}/privacy`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {locale === "zh" ? "隐私政策" : "Privacy Policy"}
              </a>
            </p>
            <label
              className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-warm-grey/20 p-4 text-sm leading-6 font-medium focus-within:ring-2 focus-within:ring-caramel/30"
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
                  setPolicyAccepted(event.target.checked)
                  clearError("policyAccepted")
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
        </>
      )}

      {errors.server?.[0] && (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
          id={serverErrorId}
          role="alert"
        >
          {errors.server[0]}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {currentStep > 1 ? (
          <button
            className="min-h-12 rounded-full border border-warm-grey/25 bg-white px-6 py-3 text-base font-semibold text-warm-charcoal transition hover:border-caramel"
            onClick={() => {
              setErrors({})
              setCurrentStep((current) => (current - 1) as PartyStep)
            }}
            type="button"
          >
            {t("back")}
          </button>
        ) : (
          <span />
        )}
        {currentStep < 3 ? (
          <button
            className="min-h-12 rounded-full bg-caramel px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={goToNextStep}
            type="button"
          >
            {t("continue")}
          </button>
        ) : (
          <button
            className="min-h-12 rounded-full bg-caramel px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        )}
      </div>
    </form>
  )
}
