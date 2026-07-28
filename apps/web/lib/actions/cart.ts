import { z } from "zod";
import {
  createRequestAttempt,
  type RequestAttempt,
} from "../requests/idempotency";

function cartSchema(locale?: string) {
  const zh = locale?.startsWith("zh") ?? false;
  return z.object({
    name: z.string().min(1, zh ? "请填写姓名" : "Name is required"),
    phone: z.string().min(1, zh ? "请填写手机号" : "Phone is required"),
    wechat: z.string().optional(),
    email: z
      .string()
      .min(1, zh ? "请填写邮箱" : "Email is required")
      .pipe(z.string().email(zh ? "邮箱格式不正确" : "Invalid email")),
    message: z.string().optional(),
    items: z.string(),
    locale: z.string().optional(),
    timeSlotId: z
      .string()
      .min(1, zh ? "请重新选择预约时段" : "Please choose a time slot again")
      .pipe(
        z
          .string()
          .uuid(zh ? "请重新选择预约时段" : "Please choose a time slot again"),
      ),
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
  });
}

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };

export async function submitCart(
  formData: FormData,
  attempt: RequestAttempt = createRequestAttempt(),
) {
  const rawData = Object.fromEntries(formData.entries());
  const locale = typeof rawData.locale === "string" ? rawData.locale : undefined;
  const parsed = cartSchema(locale).safeParse(rawData);

  if (!parsed.success) {
    attempt.failed();
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let items: Array<{
    projectId?: string;
    styleId?: string;
    projectName?: { en?: string; zh?: string } | string;
    projectType?: string;
    styleName?: { en?: string; zh?: string } | string;
    date?: string;
    people?: number;
    price?: string;
  }> = [];
  try {
    items = JSON.parse(data.items);
  } catch {
    attempt.failed();
    return { success: false, errors: { items: ["Invalid items"] } };
  }

  try {
    const res = await fetch("/api/backend/v1/cart-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": attempt.current(),
      },
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        wechat: data.wechat || undefined,
        email: data.email || undefined,
        message: data.message || undefined,
        timeSlotId: data.timeSlotId,
        preferredDate: data.preferredDate || undefined,
        numberOfPeople: Number.parseInt(data.numberOfPeople, 10),
        locale: data.locale || undefined,
        items: items.map((item) => ({
          projectId: item.projectId,
          styleId: item.styleId,
        })),
      }),
    });

    const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiError;

    if (!json.success) {
      attempt.failed();
      return {
        success: false,
        errors: { server: [json.error?.message ?? "Failed to submit. Please try again."] },
      };
    }

    attempt.succeeded();
    return { success: true, orderId: json.data.id };
  } catch {
    attempt.failed();
    return { success: false, errors: { server: ["Failed to submit. Please try again."] } };
  }
}
