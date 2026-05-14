"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { submitBooking } from "@/lib/actions/booking";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  wechat: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  preferredDate: z.string().optional(),
  numberOfPeople: z.string().optional(),
  activityType: z.string().optional(),
  interestedProject: z.string().optional(),
  message: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    const response = await submitBooking(formData);

    if (response.success) {
      setResult({ success: true, message: "Thank you! We'll contact you soon to confirm your booking." });
      reset();
    } else {
      setResult({ success: false, message: "Something went wrong. Please try again or contact us directly." });
    }
    setIsSubmitting(false);
  };

  if (result?.success) {
    return (
      <div className="rounded-2xl bg-sage/20 p-8 text-center">
        <h3 className="text-xl font-serif font-bold text-warm-charcoal">Thank You!</h3>
        <p className="mt-2 text-warm-grey">{result.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-warm-charcoal">Name *</label>
        <input
          {...register("name")}
          className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-warm-charcoal">Phone *</label>
        <input
          {...register("phone")}
          type="tel"
          className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
        />
        {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-warm-charcoal">WeChat ID</label>
          <input
            {...register("wechat")}
            className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-warm-charcoal">Email</label>
          <input
            {...register("email")}
            type="email"
            className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
          />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-warm-charcoal">Preferred Date</label>
          <input
            {...register("preferredDate")}
            type="date"
            className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-warm-charcoal">Number of People</label>
          <input
            {...register("numberOfPeople")}
            type="number"
            min="1"
            className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-warm-charcoal">Activity Type</label>
          <select
            {...register("activityType")}
            className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
          >
            <option value="">Select...</option>
            <option value="date">Date Night</option>
            <option value="birthday">Birthday Party</option>
            <option value="friends">Friends Gathering</option>
            <option value="kids">Kids Activity</option>
            <option value="mobile">Mobile Party</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-warm-charcoal">Interested Project</label>
          <input
            {...register("interestedProject")}
            className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-warm-charcoal">Message / Special Requests</label>
        <textarea
          {...register("message")}
          rows={4}
          className="mt-1 w-full rounded-lg border border-border px-4 py-2 focus:border-caramel focus:outline-none"
        />
      </div>

      {result && !result.success && (
        <p className="text-sm text-red-500">{result.message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-caramel py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Book Now"}
      </button>
    </form>
  );
}
