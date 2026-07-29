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

function ordinarySchema(locale?: string) {
  const zh = locale?.startsWith("zh") ?? false;
  const messages = {
    name: zh ? "请填写姓名" : "Name is required",
    phone: zh ? "请填写电话" : "Phone is required",
    email: zh ? "请填写邮箱" : "Email is required",
    emailInvalid: zh ? "邮箱格式不正确" : "Invalid email",
    date: zh ? "请重新选择日期" : "Please choose a date again",
    time: zh ? "请重新选择开始时段" : "Please choose a start time again",
    participants: zh
      ? "至少需要一位手作参与者"
      : "Choose at least one DIY participant",
    children: zh
      ? "4 至 8 岁儿童人数不能超过手作参与者人数"
      : "Children aged 4–8 cannot exceed DIY participants",
    adults: zh ? "陪同成人不能为负数" : "Accompanying adults cannot be negative",
    supervision: zh
      ? "有 4 至 8 岁儿童参加时，至少需要一位陪同成人"
      : "An accompanying adult is required for a child aged 4–8",
    capacity: zh
      ? "店内实际人数不能超过 8 人"
      : "Physical attendance cannot exceed 8 people",
    items: zh
      ? "每位手作参与者须选择一个项目"
      : "Choose exactly one project for each DIY participant",
    policy: zh
      ? "请接受预约政策后继续"
      : "Accept the booking policies to continue",
  };
  const itemSchema = z.union([
    z.object({
      projectId: z.string().uuid(),
      quantity: z.number().int().positive(),
      decideInStore: z.literal(false),
    }),
    z.object({
      quantity: z.number().int().positive(),
      decideInStore: z.literal(true),
    }),
  ]);
  return z
    .object({
      mode: z.enum(["booking", "waitlist"]),
      name: z.string().trim().min(1, messages.name),
      phone: z.string().trim().min(1, messages.phone),
      email: z
        .string()
        .trim()
        .min(1, messages.email)
        .pipe(z.string().email(messages.emailInvalid)),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, messages.date),
      startTime: z
        .string()
        .regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/, messages.time),
      participantCount: z.coerce.number().int().min(1, messages.participants),
      youngChildCount: z.coerce.number().int().min(0, messages.children),
      accompanyingAdultCount: z.coerce.number().int().min(0, messages.adults),
      items: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }, z.array(itemSchema).min(1, messages.items)),
      message: z.string().trim().optional(),
      locale: z.enum(["en", "zh"]),
      policyVersion: z.literal("2026-07-29"),
      policyAccepted: z
        .string()
        .refine((value) => value === "true", messages.policy),
    })
    .superRefine((data, context) => {
      if (data.youngChildCount > data.participantCount) {
        context.addIssue({
          code: "custom",
          message: messages.children,
          path: ["youngChildCount"],
        });
      }
      if (
        data.youngChildCount > 0 &&
        data.accompanyingAdultCount < 1
      ) {
        context.addIssue({
          code: "custom",
          message: messages.supervision,
          path: ["accompanyingAdultCount"],
        });
      }
      if (data.participantCount + data.accompanyingAdultCount > 8) {
        context.addIssue({
          code: "custom",
          message: messages.capacity,
          path: ["accompanyingAdultCount"],
        });
      }
      if (
        data.items.reduce((total, item) => total + item.quantity, 0) !==
        data.participantCount
      ) {
        context.addIssue({
          code: "custom",
          message: messages.items,
          path: ["items"],
        });
      }
    });
}

function ordinaryErrorMessage(code: string, locale?: string) {
  const zh = locale?.startsWith("zh") ?? false;
  if (["SLOT_FULL", "SLOT_IN_PAST", "STUDIO_CLOSED"].includes(code)) {
    return zh
      ? "该时段刚刚发生变化，请重新查看可用或候补时段。"
      : "That time just changed. Review the available and waitlist times.";
  }
  if (code === "REQUEST_FLOW_DISABLED") {
    return zh
      ? "线上申请暂未开放，请直接联系 YezYY。"
      : "Online requests are not available yet. Contact YezYY directly.";
  }
  if (code === "PROJECT_NOT_BOOKABLE") {
    return zh
      ? "所选项目已不可预约，请重新选择。"
      : "A selected project is no longer bookable. Choose again.";
  }
  return zh
    ? "申请发送失败，请重试或直接联系 YezYY。"
    : "Could not send your request. Try again or contact YezYY.";
}

async function submitOrdinaryBooking(
  rawData: Record<string, FormDataEntryValue>,
  attempt: BookingAttempt,
) {
  const locale = typeof rawData.locale === "string" ? rawData.locale : "en";
  const parsed = ordinarySchema(locale).safeParse({
    ...rawData,
    name: rawData.name ?? "",
    phone: rawData.phone ?? "",
    email: rawData.email ?? "",
    date: rawData.date ?? "",
    startTime: rawData.startTime ?? "",
    participantCount: rawData.participantCount ?? "",
    youngChildCount: rawData.youngChildCount ?? "",
    accompanyingAdultCount: rawData.accompanyingAdultCount ?? "",
    items: rawData.items ?? "",
    policyAccepted: rawData.policyAccepted ?? "",
  });
  if (!parsed.success) {
    attempt.failed();
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  const body = {
    kind: "experience" as const,
    mode: data.mode,
    name: data.name,
    phone: data.phone,
    email: data.email,
    date: data.date,
    startTime: data.startTime,
    participantCount: data.participantCount,
    youngChildCount: data.youngChildCount,
    accompanyingAdultCount: data.accompanyingAdultCount,
    items: data.items,
    ...(data.message ? { message: data.message } : {}),
    locale: data.locale,
    policyVersion: data.policyVersion,
    policyAccepted: true as const,
  };
  try {
    const response = await fetch("/api/backend/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": attempt.current(),
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as
      | ApiSuccess<{ id: string }>
      | ApiError;
    if (!result.success) {
      attempt.failed();
      return {
        success: false,
        code: result.error.code,
        errors: {
          server: [ordinaryErrorMessage(result.error.code, data.locale)],
        },
      };
    }
    attempt.succeeded();
    return { success: true, bookingId: result.data.id };
  } catch {
    attempt.failed();
    return {
      success: false,
      code: "NETWORK_ERROR",
      errors: {
        server: [ordinaryErrorMessage("NETWORK_ERROR", data.locale)],
      },
    };
  }
}

export async function submitBooking(
  formData: FormData,
  attempt: BookingAttempt = createBookingAttempt(),
) {
  const rawData = Object.fromEntries(formData.entries());
  if ("mode" in rawData || "items" in rawData || "participantCount" in rawData) {
    return submitOrdinaryBooking(rawData, attempt);
  }
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
