"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { submitBooking } from "@/lib/actions/booking";

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
      setResult({ success: true, message: b("confirmMessage") });
      reset({
        interestedProject: defaults?.interestedProject ?? "",
        preferredDate: defaults?.preferredDate ?? "",
        numberOfPeople: defaults?.numberOfPeople ?? "",
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
        <label className="block text-sm font-medium text-warm-charcoal">
          {t("name")} *
        </label>
        <input
          {...register("name")}
          className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-warm-charcoal">
          {t("phone")} *
        </label>
        <input
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
          <label className="block text-sm font-medium text-warm-charcoal">
            {t("wechat")}
          </label>
          <input
            {...register("wechat")}
            className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-warm-charcoal">
            {t("email")}
          </label>
          <input
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
              <label className="block text-sm font-medium text-warm-charcoal">
                {t("preferredDate")}
              </label>
              <input
                {...register("preferredDate")}
                type="date"
                className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-charcoal">
                {t("numberOfPeople")}
              </label>
              <input
                {...register("numberOfPeople")}
                type="number"
                min="1"
                className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-warm-charcoal">
                {t("activityType")}
              </label>
              <select
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
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-charcoal">
                {t("interestedProject")}
              </label>
              <input
                {...register("interestedProject")}
                className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
              />
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
        <label className="block text-sm font-medium text-warm-charcoal">
          {t("message")}
        </label>
        <textarea
          {...register("message")}
          rows={4}
          className="mt-1 w-full rounded-lg border border-warm-grey/20 px-4 py-2 focus:border-caramel focus:outline-none"
        />
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
