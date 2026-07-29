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
      ? "5 至 8 岁儿童人数不能超过手作参与者人数"
      : "Children aged 5–8 cannot exceed DIY participants",
    adults: zh ? "陪同成人不能为负数" : "Accompanying adults cannot be negative",
    supervision: zh
      ? "有 5 至 8 岁儿童参加时，至少需要一位陪同成人"
      : "An accompanying adult is required for a child aged 5–8",
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
    PARTY_PACKAGE_INVALID: [
      "This party package is temporarily unavailable. Contact YezYY.",
      "该派对套餐暂不可申请，请联系 YezYY。",
    ],
    PARTY_ATTENDANCE_INVALID: [
      "Party attendance must be 4–8 DIY participants plus 1–2 parents.",
      "派对须有 4 至 8 位手作参与者及 1 至 2 位陪同家长。",
    ],
    PARTY_BIRTHDAY_AGE_INVALID: [
      "The birthday child must be at least 5.",
      "生日小朋友须年满 5 岁。",
    ],
    SLOT_IN_PAST: [
      "That requested time has changed. Choose another candidate start.",
      "该申请时段已发生变化，请选择其他候选开始时段。",
    ],
    STUDIO_CLOSED: [
      "The studio is not accepting party requests at that time.",
      "店铺该时段暂不接受派对申请。",
    ],
    REQUEST_FLOW_DISABLED: [
      "Online party requests are not available yet. Contact YezYY directly.",
      "线上派对申请暂未开放，请直接联系 YezYY。",
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
  const booleanField = z
    .enum(["true", "false"])
    .transform((value) => value === "true");
  const partySchema = z.object({
    name: z.string().trim().min(1, zh ? "请填写姓名" : "Name is required"),
    phone: z.string().trim().min(1, zh ? "请填写电话" : "Phone is required"),
    email: z
      .string()
      .trim()
      .min(1, zh ? "请填写邮箱" : "Email is required")
      .pipe(z.string().email(zh ? "邮箱格式不正确" : "Invalid email")),
    partyPackageId: z
      .string()
      .uuid(zh ? "请重新选择派对套餐" : "Choose the party package again"),
    birthdayChildName: z
      .string()
      .trim()
      .min(1, zh ? "请填写生日小朋友姓名" : "Birthday child's name is required"),
    birthdayChildAge: z.coerce
      .number()
      .int()
      .min(5, zh ? "生日小朋友须年满 5 岁" : "The birthday child must be at least 5"),
    participantCount: z.coerce
      .number()
      .int()
      .min(4, zh ? "手作参与者须为 4 至 8 人" : "Choose 4 to 8 DIY participants")
      .max(8, zh ? "手作参与者须为 4 至 8 人" : "Choose 4 to 8 DIY participants"),
    parentCount: z.coerce
      .number()
      .int()
      .min(1, zh ? "须有 1 或 2 位陪同家长" : "Choose 1 or 2 accompanying parents")
      .max(2, zh ? "须有 1 或 2 位陪同家长" : "Choose 1 or 2 accompanying parents"),
    desiredDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, zh ? "请选择期望日期" : "Choose a preferred date"),
    desiredStartTime: z
      .string()
      .regex(
        /^(?:[01]\d|2[0-3]):(?:00|30)$/,
        zh ? "请选择期望开始时段" : "Choose a preferred guest start",
      ),
    projectInterests: z.preprocess((value) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }, z.array(z.string().trim().min(1)).min(1, zh ? "请至少选择一个手作项目" : "Choose at least one DIY project")),
    byoCake: booleanField,
    byoDrinks: booleanField,
    byoFood: booleanField,
    byoSnacks: booleanField,
    cakeCuttingRequested: booleanField,
    specialRequirements: z.string().trim().optional(),
    locale: z.enum(["en", "zh"]),
    policyVersion: z.literal("2026-07-29"),
    policyAccepted: z
      .string()
      .refine(
        (value) => value === "true",
        zh
          ? "请接受派对预约政策后继续"
          : "Accept the party booking policies to continue",
      ),
  });
  const parsed = partySchema.safeParse({
    ...rawData,
    name: rawData.name ?? "",
    phone: rawData.phone ?? "",
    email: rawData.email ?? "",
    partyPackageId: rawData.partyPackageId ?? "",
    birthdayChildName: rawData.birthdayChildName ?? "",
    birthdayChildAge: rawData.birthdayChildAge ?? "",
    participantCount: rawData.participantCount ?? "",
    parentCount: rawData.parentCount ?? "",
    desiredDate: rawData.desiredDate ?? "",
    desiredStartTime: rawData.desiredStartTime ?? "",
    projectInterests: rawData.projectInterests ?? "[]",
    byoCake: rawData.byoCake ?? "false",
    byoDrinks: rawData.byoDrinks ?? "false",
    byoFood: rawData.byoFood ?? "false",
    byoSnacks: rawData.byoSnacks ?? "false",
    cakeCuttingRequested: rawData.cakeCuttingRequested ?? "false",
    locale,
    policyVersion: rawData.policyVersion ?? "",
    policyAccepted: rawData.policyAccepted ?? "",
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
        name: data.name,
        phone: data.phone,
        email: data.email,
        birthdayChildName: data.birthdayChildName,
        birthdayChildAge: data.birthdayChildAge,
        participantCount: data.participantCount,
        parentCount: data.parentCount,
        desiredDate: data.desiredDate,
        desiredStartTime: data.desiredStartTime,
        projectInterests: data.projectInterests,
        byoCake: data.byoCake,
        byoDrinks: data.byoDrinks,
        byoFood: data.byoFood,
        byoSnacks: data.byoSnacks,
        cakeCuttingRequested: data.cakeCuttingRequested,
        ...(data.specialRequirements
          ? { specialRequirements: data.specialRequirements }
          : {}),
        locale: data.locale,
        policyVersion: data.policyVersion,
        policyAccepted: true,
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
