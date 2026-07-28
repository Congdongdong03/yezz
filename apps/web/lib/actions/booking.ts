import { z } from "zod";
import {
  createRequestAttempt,
  type RequestAttempt,
} from "../requests/idempotency";

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
type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type BookingAttempt = RequestAttempt;
export const createBookingAttempt = createRequestAttempt;

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
    attempt.failed();
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  try {
    const res = await fetch("/api/backend/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": attempt.current(),
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
      attempt.failed();
      return {
        success: false,
        errors: { server: [json.error?.message ?? "Failed to submit booking. Please try again."] },
      };
    }

    attempt.succeeded();
    return { success: true, bookingId: json.data.id };
  } catch {
    attempt.failed();
    return {
      success: false,
      errors: { server: ["Failed to submit booking. Please try again."] },
    };
  }
}

function partyErrorMessage(code: string, locale?: string): string {
  const zh = locale?.startsWith("zh") ?? false;
  const messages: Record<string, [string, string]> = {
    PARTY_PACKAGE_NOT_FOUND: [
      "This party package is no longer available. Please choose another package.",
      "该派对套餐已不可预约，请选择其他套餐。",
    ],
    PARTY_SIZE_INVALID: [
      "The group size no longer fits this package. Check the current range and try again.",
      "人数不符合该套餐的最新范围，请核对后重试。",
    ],
    SLOT_PARTY_MISMATCH: [
      "That time is not available for parties. Please choose another time.",
      "该时段不适用于派对预约，请选择其他时段。",
    ],
    SLOT_FULL: [
      "That time is no longer available. Please choose another time.",
      "该时段已不可预约，请选择其他时段。",
    ],
    SLOT_IN_PAST: [
      "That time has passed. Please choose another time.",
      "该时段已过，请选择其他时段。",
    ],
  };
  const pair = messages[code];
  if (pair) return pair[zh ? 1 : 0];
  return zh
    ? "提交失败，请重试或直接联系我们。"
    : "Could not send your request. Try again or contact us.";
}

export async function submitPartyBooking(
  formData: FormData,
  attempt: BookingAttempt = createBookingAttempt(),
) {
  const rawData = Object.fromEntries(formData.entries());
  const locale = typeof rawData.locale === "string" ? rawData.locale : "en";
  const zh = locale.startsWith("zh");
  const minPeople = Number(rawData.minPeople);
  const maxPeople = Number(rawData.maxPeople);
  const partySchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, zh ? "请填写姓名" : "Name is required"),
    phone: z
      .string()
      .trim()
      .min(1, zh ? "请填写电话" : "Phone is required"),
    email: z
      .string()
      .trim()
      .min(1, zh ? "请填写邮箱" : "Email is required")
      .pipe(z.string().email(zh ? "邮箱格式不正确" : "Invalid email")),
    wechat: z.string().optional(),
    message: z.string().optional(),
    preferredDate: z
      .string()
      .min(1, zh ? "请重新选择日期" : "Please choose a date again"),
    numberOfPeople: z
      .string()
      .min(1, zh ? "请填写人数" : "People is required")
      .refine(
        (value) => {
          const people = Number(value);
          return (
            Number.isInteger(people) &&
            Number.isInteger(minPeople) &&
            Number.isInteger(maxPeople) &&
            people >= minPeople &&
            people <= maxPeople
          );
        },
        zh
          ? `派对人数须为 ${minPeople} 至 ${maxPeople} 人`
          : `Party size must be ${minPeople}–${maxPeople} people`,
      ),
    partyPackageId: z
      .string()
      .uuid(zh ? "请重新选择派对套餐" : "Please choose a party package again"),
    timeSlotId: z
      .string()
      .uuid(zh ? "请重新选择预约时段" : "Please choose a time slot again"),
  });
  const parsed = partySchema.safeParse({
    ...rawData,
    name: rawData.name ?? "",
    phone: rawData.phone ?? "",
    email: rawData.email ?? "",
    preferredDate: rawData.preferredDate ?? "",
    numberOfPeople: rawData.numberOfPeople ?? "",
    partyPackageId: rawData.partyPackageId ?? "",
    timeSlotId: rawData.timeSlotId ?? "",
  });

  if (!parsed.success) {
    attempt.failed();
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  try {
    const res = await fetch("/api/backend/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": attempt.current(),
      },
      body: JSON.stringify({
        kind: "party",
        partyPackageId: data.partyPackageId,
        timeSlotId: data.timeSlotId,
        preferredDate: data.preferredDate,
        numberOfPeople: Number.parseInt(data.numberOfPeople, 10),
        name: data.name,
        phone: data.phone,
        ...(data.wechat ? { wechat: data.wechat } : {}),
        email: data.email,
        ...(data.message ? { message: data.message } : {}),
        locale,
      }),
    });
    const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiError;
    if (!json.success) {
      attempt.failed();
      return {
        success: false,
        errors: { server: [partyErrorMessage(json.error.code, locale)] },
      };
    }
    attempt.succeeded();
    return { success: true, bookingId: json.data.id };
  } catch {
    attempt.failed();
    return {
      success: false,
      errors: { server: [partyErrorMessage("NETWORK_ERROR", locale)] },
    };
  }
}
