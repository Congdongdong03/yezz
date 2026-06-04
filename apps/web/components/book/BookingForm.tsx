"use client";

import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { submitBooking } from "@/lib/actions/booking";
import { trackSubmitBooking } from "@/lib/analytics/gtag";

export type BookingFormDefaults = {
  interestedProject?: string;
  preferredDate?: string;
  numberOfPeople?: string;
  timeSlotId?: string;
  locale?: string;
};

type BookingFormProps = {
  defaults?: BookingFormDefaults;
  /** Hide project/activity fields when embedded on a project detail page */
  embedded?: boolean;
  requireTimeSlot?: boolean;
};

export default function BookingForm({
  defaults,
  embedded = false,
  requireTimeSlot = false,
}: BookingFormProps) {
  const t = useTranslations("bookingForm");
  const b = useTranslations("book");
  const id = useId();
  const fieldId = (name: string) => `${id}-${name}`;

  const formSchema = z.object({
    name: z.string().min(1, t("nameRequired")),
    phone: z.string().min(1, t("phoneRequired")),
    wechat: z.string().optional(),
    email: z.string().email(t("emailInvalid")).optional().or(z.literal("")),
    preferredDate: z.string().optional(),
    numberOfPeople: z.string().optional(),
    activityType: z.string().optional(),
    interestedProject: z.string().optional(),
    message: z.string().optional(),
  });

  type FormData = z.infer<typeof formSchema>;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interestedProject: defaults?.interestedProject ?? "",
      preferredDate: defaults?.preferredDate ?? "",
      numberOfPeople: defaults?.numberOfPeople ?? "",
    },
  });

  useEffect(() => {
    if (defaults?.interestedProject) setValue("interestedProject", defaults.interestedProject);
    if (defaults?.preferredDate) setValue("preferredDate", defaults.preferredDate);
    if (defaults?.numberOfPeople) setValue("numberOfPeople", defaults.numberOfPeople);
  }, [defaults, setValue]);

  const onSubmit = async (data: FormData) => {
    if (requireTimeSlot && !defaults?.timeSlotId) {
      setResult({ success: false, message: b("selectSlotFirst") });
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });
    if (defaults?.timeSlotId) formData.append("timeSlotId", defaults.timeSlotId);
    if (defaults?.locale) formData.append("locale", defaults.locale);

    const response = await submitBooking(formData);

    if (response.success) {
      trackSubmitBooking({
        project_slug: data.interestedProject,
        project_name: data.interestedProject,
      });
      setResult({ success: true, message: b("confirmMessage") });
      reset({
        interestedProject: defaults?.interestedProject ?? "",
        preferredDate: defaults?.preferredDate ?? "",
        numberOfPeople: defaults?.numberOfPeople ?? "",
      });
    } else if ("errors" in response && response.errors) {
      const apiErrors = response.errors as Record<string, string[] | undefined>;
      const fieldKeys = [
        "name",
        "phone",
        "wechat",
        "email",
        "preferredDate",
        "numberOfPeople",
        "activityType",
        "interestedProject",
        "message",
      ] as const;
      for (const key of fieldKeys) {
        const messages = apiErrors[key];
        if (messages?.[0]) {
          setError(key, { message: messages[0] });
        }
      }
      const serverMsg = apiErrors.server?.[0];
      setResult({
        success: false,
        message: serverMsg ?? b("errorMessage"),
      });
    } else {
      setResult({ success: false, message: b("errorMessage") });
    }
    setIsSubmitting(false);
  };

  if (result?.success) {
    return (
      <div className="rounded-2xl bg-sage/20 p-8 text-center">
        <h3 className="font-serif text-xl font-bold text-warm-charcoal">
          {b("thankYou")}
        </h3>
        <p className="mt-2 text-warm-grey">{result.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor={fieldId("name")} className="block text-sm font-medium text-warm-charcoal">
          {t("name")} *
        </label>
        <input
          id={fieldId("name")}
          {...register("name")}
          className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("phone")} className="block text-sm font-medium text-warm-charcoal">
          {t("phone")} *
        </label>
        <input
          id={fieldId("phone")}
          {...register("phone")}
          type="tel"
          className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor={fieldId("wechat")} className="block text-sm font-medium text-warm-charcoal">
            {t("wechat")}
          </label>
          <input
            id={fieldId("wechat")}
            {...register("wechat")}
            className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
          />
          {errors.wechat && (
            <p className="mt-1 text-sm text-red-500">{errors.wechat.message}</p>
          )}
        </div>
        <div>
          <label htmlFor={fieldId("email")} className="block text-sm font-medium text-warm-charcoal">
            {t("email")}
          </label>
          <input
            id={fieldId("email")}
            {...register("email")}
            type="email"
            className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
      </div>

      {!embedded && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor={fieldId("preferredDate")} className="block text-sm font-medium text-warm-charcoal">
                {t("preferredDate")}
              </label>
              <input
                id={fieldId("preferredDate")}
                {...register("preferredDate")}
                type="date"
                className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
              />
              {errors.preferredDate && (
                <p className="mt-1 text-sm text-red-500">{errors.preferredDate.message}</p>
              )}
            </div>
            <div>
              <label htmlFor={fieldId("numberOfPeople")} className="block text-sm font-medium text-warm-charcoal">
                {t("numberOfPeople")}
              </label>
              <input
                id={fieldId("numberOfPeople")}
                {...register("numberOfPeople")}
                type="number"
                min="1"
                className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
              />
              {errors.numberOfPeople && (
                <p className="mt-1 text-sm text-red-500">{errors.numberOfPeople.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor={fieldId("activityType")} className="block text-sm font-medium text-warm-charcoal">
                {t("activityType")}
              </label>
              <select
                id={fieldId("activityType")}
                {...register("activityType")}
                className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
              >
                <option value="">{t("activitySelect")}</option>
                <option value="date">{t("activityDate")}</option>
                <option value="birthday">{t("activityBirthday")}</option>
                <option value="friends">{t("activityFriends")}</option>
                <option value="kids">{t("activityKids")}</option>
                <option value="mobile">{t("activityMobile")}</option>
              </select>
              {errors.activityType && (
                <p className="mt-1 text-sm text-red-500">{errors.activityType.message}</p>
              )}
            </div>
            <div>
              <label htmlFor={fieldId("interestedProject")} className="block text-sm font-medium text-warm-charcoal">
                {t("interestedProject")}
              </label>
              <input
                id={fieldId("interestedProject")}
                {...register("interestedProject")}
                className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
              />
              {errors.interestedProject && (
                <p className="mt-1 text-sm text-red-500">{errors.interestedProject.message}</p>
              )}
            </div>
          </div>
        </>
      )}

      {embedded && (
        <>
          <input type="hidden" {...register("interestedProject")} />
          <input type="hidden" {...register("preferredDate")} />
          <input type="hidden" {...register("numberOfPeople")} />
        </>
      )}

      <div>
        <label htmlFor={fieldId("message")} className="block text-sm font-medium text-warm-charcoal">
          {t("message")}
        </label>
        <textarea
          id={fieldId("message")}
          {...register("message")}
          rows={4}
          className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
        />
        {errors.message && (
          <p className="mt-1 text-sm text-red-500">{errors.message.message}</p>
        )}
      </div>

      {result && !result.success && (
        <p className="text-sm text-red-500">{result.message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-caramel py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      >
        {isSubmitting ? b("submitting") : b("submit")}
      </button>
    </form>
  );
}
