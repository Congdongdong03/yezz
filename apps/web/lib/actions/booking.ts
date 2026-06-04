"use server";

import { z } from "zod";
import { getApiBaseUrl } from "@/lib/api/config";

const bookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  wechat: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  preferredDate: z.string().optional(),
  numberOfPeople: z.string().optional(),
  activityType: z.string().optional(),
  interestedProject: z.string().optional(),
  message: z.string().optional(),
  timeSlotId: z.string().optional(),
  locale: z.string().optional(),
});

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };

export async function submitBooking(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = bookingSchema.safeParse(rawData);

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        wechat: data.wechat || undefined,
        email: data.email || undefined,
        preferredDate: data.preferredDate || undefined,
        numberOfPeople: data.numberOfPeople
          ? Number.parseInt(data.numberOfPeople, 10)
          : undefined,
        activityType: data.activityType || undefined,
        interestedProject: data.interestedProject || undefined,
        message: data.message || undefined,
        timeSlotId: data.timeSlotId || undefined,
        locale: data.locale || undefined,
      }),
    });

    const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiError;

    if (!json.success) {
      return {
        success: false,
        errors: { server: [json.error?.message ?? "Failed to submit booking. Please try again."] },
      };
    }

    return { success: true, bookingId: json.data.id };
  } catch (error) {
    console.error("Booking submission error:", error);
    return {
      success: false,
      errors: { server: ["Failed to submit booking. Please try again."] },
    };
  }
}
