import { z } from "zod";

function bookingSchema(locale?: string) {
  const zh = locale?.startsWith("zh") ?? false;
  return z.object({
    name: z.string().min(1, zh ? "请填写姓名" : "Name is required"),
    phone: z.string().min(1, zh ? "请填写手机号" : "Phone is required"),
    wechat: z.string().optional(),
    email: z
      .string()
      .min(1, zh ? "请填写邮箱" : "Email is required")
      .pipe(z.string().email(zh ? "邮箱格式不正确" : "Invalid email")),
    preferredDate: z.string().optional(),
    numberOfPeople: z
      .string()
      .min(1, zh ? "请填写人数" : "People is required")
      .refine(
        (value) => {
          const people = Number(value);
          return Number.isInteger(people) && people >= 1;
        },
        zh ? "人数至少为 1" : "People must be at least 1",
      ),
    activityType: z.string().optional(),
    interestedProject: z.string().optional(),
    projectId: z
      .string()
      .min(1, zh ? "请重新选择体验项目" : "Please choose an experience again")
      .pipe(
        z
          .string()
          .uuid(zh ? "请重新选择体验项目" : "Please choose an experience again"),
      ),
    message: z.string().optional(),
    timeSlotId: z
      .string()
      .min(1, zh ? "请重新选择预约时段" : "Please choose a time slot again")
      .pipe(
        z
          .string()
          .uuid(zh ? "请重新选择预约时段" : "Please choose a time slot again"),
      ),
    locale: z.string().optional(),
  });
}

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };

export type BookingAttempt = {
  idempotencyKey: string;
};

export function createBookingAttempt(): BookingAttempt {
  return { idempotencyKey: globalThis.crypto.randomUUID() };
}

export async function submitBooking(
  formData: FormData,
  attempt: BookingAttempt = createBookingAttempt(),
) {
  const rawData = Object.fromEntries(formData.entries());
  const locale = typeof rawData.locale === "string" ? rawData.locale : undefined;
  const parsed = bookingSchema(locale).safeParse({
    ...rawData,
    email: rawData.email ?? "",
    numberOfPeople: rawData.numberOfPeople ?? "",
    projectId: rawData.projectId ?? "",
    timeSlotId: rawData.timeSlotId ?? "",
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  try {
    const res = await fetch("/api/backend/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": attempt.idempotencyKey,
      },
      body: JSON.stringify({
        kind: "experience",
        projectId: data.projectId,
        name: data.name,
        phone: data.phone,
        wechat: data.wechat || undefined,
        email: data.email,
        preferredDate: data.preferredDate || undefined,
        numberOfPeople: data.numberOfPeople
          ? Number.parseInt(data.numberOfPeople, 10)
          : undefined,
        activityType: data.activityType || undefined,
        interestedProject: data.interestedProject || undefined,
        message: data.message || undefined,
        timeSlotId: data.timeSlotId,
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

    attempt.idempotencyKey = globalThis.crypto.randomUUID();
    return { success: true, bookingId: json.data.id };
  } catch {
    return {
      success: false,
      errors: { server: ["Failed to submit booking. Please try again."] },
    };
  }
}
