"use client";

import { useCallback, useId, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CURRENT_BOOKING_POLICY_VERSION } from "@/lib/booking/policy-version";
import AttendanceFields, {
  validateOrdinaryAttendance,
  type OrdinaryAttendance,
} from "./AttendanceFields";
import ProjectQuantityPicker, {
  summarizeProjectSelection,
  type OrdinaryBookingItemSelection,
  type OrdinaryBookingProject,
} from "./ProjectQuantityPicker";
import PolicyConsent from "./PolicyConsent";
import BookingCalendar from "./BookingCalendar";
import RequestContactFallback from "@/components/RequestContactFallback";
import { createBookingAttempt, submitBooking } from "@/lib/actions/booking";
import {
  getOrdinaryAvailability,
  type OrdinaryAvailabilitySlot,
} from "@/lib/api/availability";
import { YEZYY_BUSINESS_PROFILE, formatPhoneHref } from "@/lib/site/business";
import { trackSubmitBooking } from "@/lib/analytics/gtag";
import BookingSelectionSummary from "./BookingSelectionSummary";
import PhotoConsentField from "./PhotoConsentField";
import {
  CURRENT_PHOTO_CONSENT_VERSION,
  type PhotoConsentDecision,
} from "@/lib/booking/photo-consent";

type OrdinaryBookingFormProps = {
  initialProjectId?: string;
  locale: "en" | "zh";
  projects: OrdinaryBookingProject[];
  requestEnabled: boolean;
};

type FormErrors = Record<string, string[] | undefined>;

export default function OrdinaryBookingForm({
  initialProjectId,
  locale,
  projects,
  requestEnabled,
}: OrdinaryBookingFormProps) {
  const t = useTranslations("ordinaryBooking");
  const id = useId();
  const [attendance, setAttendance] = useState<OrdinaryAttendance>({
    participantCount: 1,
    youngChildCount: 0,
    accompanyingAdultCount: 0,
  });
  const [items, setItems] = useState<OrdinaryBookingItemSelection[]>(() => {
    const initialProject = projects.find(
      (project) => project.id === initialProjectId,
    );
    return initialProject
      ? [
          {
            projectId: initialProject.id,
            quantity: 1,
            decideInStore: false as const,
          },
        ]
      : [];
  });
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] =
    useState<OrdinaryAvailabilitySlot | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [photoConsentDecision, setPhotoConsentDecision] =
    useState<PhotoConsentDecision>("declined");
  const [photoConsentSignerName, setPhotoConsentSignerName] = useState("");
  const [attempt] = useState(createBookingAttempt);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [projectValidationRequested, setProjectValidationRequested] =
    useState(false);
  const [success, setSuccess] = useState<{
    mode: "booking" | "waitlist";
    bookingId: string;
    bookingNumber: string;
  } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [calendarRevision, setCalendarRevision] = useState(0);

  const attendanceErrors = validateOrdinaryAttendance(attendance);
  const selection = useMemo(
    () => summarizeProjectSelection(items, projects),
    [items, projects],
  );
  const attendanceCount =
    attendance.participantCount + attendance.accompanyingAdultCount;
  const scheduleReady =
    Object.keys(attendanceErrors).length === 0 &&
    selection.quantity === attendance.participantCount &&
    Boolean(selection.durationMinutes);
  const ignoreLegacySlot = useCallback(() => {}, []);
  const handleDateChange = useCallback((value: string) => {
    setDate(value);
    setSelectedSlot(null);
    setErrors((current) => ({
      ...current,
      slot: undefined,
      server: undefined,
    }));
  }, []);
  const handleSelectOrdinarySlot = useCallback(
    (slot: OrdinaryAvailabilitySlot | null) => {
      setSelectedSlot(slot);
      setErrors((current) => ({
        ...current,
        slot: undefined,
        server: undefined,
      }));
    },
    [],
  );

  if (!requestEnabled) {
    return (
      <div className="space-y-4">
        <RequestContactFallback locale={locale} />
        <address className="rounded-2xl border border-warm-grey/15 bg-white px-6 py-4 text-center text-sm leading-6 text-warm-grey not-italic">
          <p>{YEZYY_BUSINESS_PROFILE.address}</p>
          <p>
            {locale === "zh" ? "小红书" : "Xiaohongshu"}:{" "}
            {YEZYY_BUSINESS_PROFILE.xiaohongshu}
          </p>
        </address>
      </div>
    );
  }

  if (success) {
    return (
      <section
        className="rounded-3xl border border-sage/50 bg-sage/15 p-6 sm:p-8"
        role="status"
      >
        <h2 className="font-serif text-2xl font-semibold text-warm-charcoal">
          {t("successTitle")}
        </h2>
        <p className="mt-3 leading-7 text-warm-charcoal">
          {success.mode === "waitlist"
            ? t("successWaitlist")
            : t("successBooking")}
        </p>
        <div className="mt-5 rounded-xl border border-sage/40 bg-white/80 px-4 py-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-warm-grey uppercase">
            {t("bookingReference")}
          </p>
          <p className="mt-1 font-mono text-base font-semibold text-warm-charcoal">
            {success.bookingNumber}
          </p>
        </div>
        <p className="mt-4 rounded-xl border border-caramel/25 bg-caramel/5 px-4 py-3 text-sm leading-6 text-warm-charcoal">
          {t("confirmationMethod")}
        </p>
        <BookingSelectionSummary
          attendance={attendance}
          date={date}
          items={items}
          locale={locale}
          projects={projects}
          startTime={selectedSlot?.startTime ?? null}
        />
        <p className="mt-4 rounded-xl border border-sage/40 bg-white/70 px-4 py-3 text-sm leading-6 text-warm-charcoal">
          <strong>{YEZYY_BUSINESS_PROFILE.currency}</strong> · {t("payInStore")}
        </p>
        <address className="mt-4 rounded-xl bg-white/70 p-4 text-sm leading-6 text-warm-grey not-italic">
          <p>{YEZYY_BUSINESS_PROFILE.address}</p>
          <p>
            <a
              className="text-caramel underline-offset-4 hover:underline"
              href={`tel:${formatPhoneHref(YEZYY_BUSINESS_PROFILE.phone)}`}
            >
              {YEZYY_BUSINESS_PROFILE.phone}
            </a>
            {" · "}
            <a
              className="text-caramel underline-offset-4 hover:underline"
              href={`mailto:${YEZYY_BUSINESS_PROFILE.email}`}
            >
              {YEZYY_BUSINESS_PROFILE.email}
            </a>
          </p>
          <p>
            {locale === "zh" ? "小红书" : "Xiaohongshu"}:{" "}
            {YEZYY_BUSINESS_PROFILE.xiaohongshu}
          </p>
        </address>
      </section>
    );
  }

  const fieldId = (name: string) => `${id}-${name}`;
  const errorId = (name: string) => `${id}-${name}-error`;
  const serverErrorId = `${id}-server-error`;
  const scheduleDateId = `${id}-schedule-date`;
  const scheduleErrorId = `${id}-schedule-error`;
  const inputClass =
    "mt-2 min-h-11 w-full rounded-xl border border-warm-grey/25 bg-white px-3 text-base text-warm-charcoal outline-none transition focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25";

  const validateContact = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const next: FormErrors = {};
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    if (!name) next.name = [t("nameRequired")];
    if (!phone) next.phone = [t("phoneRequired")];
    if (!email) {
      next.email = [t("emailRequired")];
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = [t("emailInvalid")];
    }
    if (Object.keys(attendanceErrors).length > 0) {
      next.attendance = [t("attendanceInvalid")];
    }
    if (
      selection.quantity !== attendance.participantCount ||
      !selection.durationMinutes
    ) {
      next.items = [t("itemsInvalid")];
    }
    if (!selectedSlot || !date) next.slot = [t("selectSlot")];
    if (!policyAccepted) next.policyAccepted = [t("policyRequired")];
    if (
      photoConsentDecision !== "declined" &&
      photoConsentSignerName.trim().length < 2
    ) {
      next.photoConsentSignerName = [
        locale === "zh"
          ? "请填写同意授权人的全名"
          : "Enter the consenting adult or guardian’s full name",
      ];
    }
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const localErrors = validateContact(form);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      if (localErrors.slot?.[0]) {
        document.getElementById(scheduleDateId)?.focus();
      } else {
        const firstInvalidContactField = ["name", "phone", "email"].find(
          (name) => localErrors[name]?.[0],
        );
        if (firstInvalidContactField) {
          document.getElementById(fieldId(firstInvalidContactField))?.focus();
        }
      }
      return;
    }
    const slot = selectedSlot!;
    const durationMinutes = selection.durationMinutes!;
    setSubmitting(true);
    setErrors({});
    try {
      const freshSlots = await getOrdinaryAvailability({
        attendance: attendanceCount,
        date,
        durationMinutes,
      });
      const freshSlot = freshSlots.find(
        (candidate) => candidate.startTime === slot.startTime,
      );
      if (!freshSlot || freshSlot.status !== slot.status) {
        setSelectedSlot(null);
        setCalendarRevision((value) => value + 1);
        setErrors({ server: [t("staleSlot")] });
        return;
      }

      const formData = new FormData(form);
      formData.set("mode", slot.status === "waitlist" ? "waitlist" : "booking");
      formData.set("date", date);
      formData.set("startTime", slot.startTime);
      formData.set("participantCount", String(attendance.participantCount));
      formData.set("youngChildCount", String(attendance.youngChildCount));
      formData.set(
        "accompanyingAdultCount",
        String(attendance.accompanyingAdultCount),
      );
      formData.set("items", JSON.stringify(items));
      formData.set("locale", locale);
      formData.set("policyVersion", CURRENT_BOOKING_POLICY_VERSION);
      formData.set("policyAccepted", "true");
      formData.set("photoConsentDecision", photoConsentDecision);
      formData.set("photoConsentSignerName", photoConsentSignerName.trim());
      formData.set("photoConsentVersion", CURRENT_PHOTO_CONSENT_VERSION);

      const result = await submitBooking(formData, attempt);
      if (result.success) {
        const bookingId =
          "bookingId" in result && typeof result.bookingId === "string"
            ? result.bookingId
            : null;
        if (!bookingId) {
          setErrors({ server: [t("genericError")] });
          return;
        }
        const selectedProjects = items.flatMap((item) => {
          if (item.decideInStore) return [];
          const project = projects.find(
            (candidate) => candidate.id === item.projectId,
          );
          return project ? [project] : [];
        });
        trackSubmitBooking({
          booking_mode: slot.status === "waitlist" ? "waitlist" : "booking",
          project_ids: selectedProjects.map((project) => project.id),
          project_name:
            selectedProjects
              .map((project) => project.name[locale])
              .join(", ") || (locale === "zh" ? "到店决定" : "Decide in store"),
        });
        setSuccess({
          mode: slot.status === "waitlist" ? "waitlist" : "booking",
          bookingId,
          bookingNumber:
            "bookingNumber" in result &&
            typeof result.bookingNumber === "string"
              ? result.bookingNumber
              : `booking-${bookingId.slice(0, 8).toUpperCase()}`,
        });
      } else {
        if (
          "code" in result &&
          ["SLOT_FULL", "SLOT_IN_PAST", "STUDIO_CLOSED"].includes(
            String(result.code),
          )
        ) {
          setSelectedSlot(null);
          setCalendarRevision((value) => value + 1);
          setCurrentStep(3);
        }
        setErrors(result.errors as FormErrors);
      }
    } catch {
      setErrors({ server: [t("genericError")] });
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (
    name: "name" | "phone" | "email",
    type: "text" | "tel" | "email",
  ) => {
    const fieldError = errors[name]?.[0];
    return (
      <div>
        <label
          className="text-sm font-semibold text-warm-charcoal"
          htmlFor={fieldId(name)}
        >
          {t(name)} *
        </label>
        <input
          aria-describedby={fieldError ? errorId(name) : undefined}
          aria-invalid={Boolean(fieldError)}
          className={inputClass}
          id={fieldId(name)}
          name={name}
          required
          type={type}
        />
        {fieldError && (
          <p
            className="mt-1 text-sm text-red-700"
            id={errorId(name)}
            role="alert"
          >
            {fieldError}
          </p>
        )}
      </div>
    );
  };

  const updateAttendance = (value: OrdinaryAttendance) => {
    setItems((current) => {
      const assigned = current.reduce(
        (total, item) => total + item.quantity,
        0,
      );
      if (
        current.length === 1 &&
        assigned === attendance.participantCount &&
        value.participantCount > 0
      ) {
        return [{ ...current[0], quantity: value.participantCount }];
      }
      return current;
    });
    setAttendance(value);
    setSelectedSlot(null);
    setErrors((current) => ({
      ...current,
      attendance: undefined,
      items: undefined,
      server: undefined,
    }));
  };

  const goToNextStep = () => {
    if (currentStep === 1) {
      if (
        selection.quantity !== attendance.participantCount ||
        !selection.durationMinutes
      ) {
        setProjectValidationRequested(true);
        setErrors((current) => ({
          ...current,
          items: [t("itemsInvalid")],
        }));
        return;
      }
      setErrors((current) => ({ ...current, items: undefined }));
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      if (Object.keys(attendanceErrors).length > 0) {
        setErrors((current) => ({
          ...current,
          attendance: [t("attendanceInvalid")],
        }));
        return;
      }
      if (selection.quantity !== attendance.participantCount) {
        setProjectValidationRequested(true);
        setErrors((current) => ({
          ...current,
          items: [t("itemsInvalid")],
        }));
        setCurrentStep(1);
        return;
      }
      setErrors((current) => ({ ...current, attendance: undefined }));
      setCurrentStep(3);
      return;
    }
    if (!selectedSlot || !date) {
      setErrors((current) => ({
        ...current,
        slot: [t("selectSlot")],
      }));
      document.getElementById(scheduleDateId)?.focus();
      return;
    }
    setErrors((current) => ({ ...current, slot: undefined }));
    setCurrentStep(4);
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(1, step - 1) as 1 | 2 | 3 | 4);
  };

  const stepClass =
    "relative rounded-3xl border border-warm-grey/15 bg-white p-5 shadow-sm sm:p-7";
  const stepLabelClass =
    "mb-5 flex items-center gap-3 font-serif text-xl font-semibold text-warm-charcoal";
  const steps = [
    t("stepProjects"),
    t("stepPeople"),
    t("stepSchedule"),
    t("stepContact"),
  ];

  return (
    <form
      aria-describedby={errors.server?.[0] ? serverErrorId : undefined}
      aria-label={t("formLabel")}
      className="space-y-6"
      onSubmit={onSubmit}
    >
      <div className="rounded-3xl border border-caramel/25 bg-caramel/5 p-5 sm:p-7">
        <p className="max-w-2xl text-sm leading-6 text-warm-charcoal">
          {t("intro")}
        </p>
        <ol className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-warm-grey sm:grid-cols-4">
          {steps.map((label, index) => (
            <li
              aria-current={currentStep === index + 1 ? "step" : undefined}
              className={`flex items-center gap-2 ${
                currentStep === index + 1 ? "text-warm-charcoal" : ""
              }`}
              key={label}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  currentStep === index + 1
                    ? "bg-caramel text-white"
                    : currentStep > index + 1
                      ? "bg-sage text-warm-charcoal"
                      : "bg-warm-grey/15 text-warm-grey"
                }`}
              >
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </div>

      <BookingSelectionSummary
        attendance={attendance}
        date={date}
        items={items}
          locale={locale}
        projects={projects}
        startTime={selectedSlot?.startTime ?? null}
        />

      <p className="text-center text-xs font-semibold tracking-[0.14em] text-warm-grey uppercase">
        {t("stepOf", { current: currentStep, total: 4 })}
      </p>

      {currentStep === 1 ? (
      <section className={stepClass}>
        <h2 className={stepLabelClass}>
            <span className="text-caramel">01</span> {t("stepProjects")}
        </h2>
        <ProjectQuantityPicker
          locale={locale}
          onChange={(value) => {
            setItems(value);
              const assignedParticipants = value.reduce(
                (total, item) => total + item.quantity,
                0,
              );
              if (
                assignedParticipants > 0 &&
                assignedParticipants !== attendance.participantCount
              ) {
                setAttendance((current) => ({
                  ...current,
                  participantCount: assignedParticipants,
                  youngChildCount: Math.min(
                    current.youngChildCount,
                    assignedParticipants,
                  ),
                }));
              }
            setSelectedSlot(null);
            setErrors((current) => ({
              ...current,
              items: undefined,
              server: undefined,
            }));
          }}
          participantCount={attendance.participantCount}
          projects={projects}
            showValidation={projectValidationRequested}
          value={items}
        />
      </section>
      ) : null}

      {currentStep === 2 ? (
        <section className={stepClass}>
          <h2 className={stepLabelClass}>
            <span className="text-caramel">02</span> {t("stepPeople")}
          </h2>
          <AttendanceFields
            locale={locale}
            onChange={updateAttendance}
            value={attendance}
          />
        </section>
      ) : null}

      {currentStep === 3 ? (
      <section className={stepClass}>
        <h2 className={stepLabelClass}>
          <span className="text-caramel">03</span> {t("stepSchedule")}
        </h2>
        {scheduleReady ? (
          <>
            <p className="mb-4 text-sm text-warm-grey">
              {t("scheduleReady")}
            </p>
            <BookingCalendar
              onDateChange={handleDateChange}
              onSelectOrdinarySlot={handleSelectOrdinarySlot}
              onSelectSlot={ignoreLegacySlot}
              ordinaryAvailability={{
                attendance: attendanceCount,
                durationMinutes: selection.durationMinutes!,
              }}
              ordinaryCalendarId={scheduleDateId}
              ordinaryRefreshKey={calendarRevision}
              ordinaryScheduleErrorId={
                errors.slot?.[0] ? scheduleErrorId : undefined
              }
              ordinaryScheduleInvalid={Boolean(errors.slot?.[0])}
              people={attendanceCount}
              selectedOrdinaryStartTime={selectedSlot?.startTime ?? null}
              selectedSlotId={null}
            />
          </>
        ) : (
          <p className="rounded-xl bg-warm-grey/10 px-4 py-3 text-sm text-warm-grey">
            {t("scheduleNotReady")}
          </p>
        )}
        {errors.slot?.[0] && (
          <p
            className="mt-3 text-sm text-red-700"
            id={scheduleErrorId}
            role="alert"
          >
            {errors.slot[0]}
          </p>
        )}
      </section>
      ) : null}

      {currentStep === 4 ? (
      <section className={stepClass}>
        <h2 className={stepLabelClass}>
          <span className="text-caramel">04</span> {t("stepContact")}
        </h2>
        <p className="mb-5 rounded-xl border border-sage/35 bg-sage/10 px-4 py-3 text-sm leading-6 text-warm-charcoal">
          {t("payInStore")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {renderField("name", "text")}
          {renderField("phone", "tel")}
        </div>
        <div className="mt-4">{renderField("email", "email")}</div>
          <div className="mt-6">
            <PhotoConsentField
              decision={photoConsentDecision}
              error={errors.photoConsentSignerName?.[0]}
              locale={locale}
              onDecisionChange={(decision) => {
                setPhotoConsentDecision(decision);
                if (decision === "declined") setPhotoConsentSignerName("");
                setErrors((current) => ({
                  ...current,
                  photoConsentSignerName: undefined,
                }));
              }}
              onSignerNameChange={(name) => {
                setPhotoConsentSignerName(name);
                setErrors((current) => ({
                  ...current,
                  photoConsentSignerName: undefined,
                }));
              }}
              signerName={photoConsentSignerName}
            />
          </div>
        <div className="mt-6">
          <PolicyConsent
            checked={policyAccepted}
            error={errors.policyAccepted?.[0]}
            locale={locale}
            onChange={(checked) => {
              setPolicyAccepted(checked);
              setErrors((current) => ({
                ...current,
                policyAccepted: undefined,
              }));
            }}
          />
        </div>
      </section>
      ) : null}

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
            onClick={goToPreviousStep}
            type="button"
          >
            {t("back")}
          </button>
        ) : (
          <span />
        )}
        {currentStep < 4 ? (
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
        {submitting
          ? t("submitting")
          : selectedSlot?.status === "waitlist"
            ? t("submitWaitlist")
            : t("submitBooking")}
      </button>
        )}
      </div>
    </form>
  );
}
