"use server";

import { z } from "zod";
import { getApiBaseUrl } from "@/lib/api/config";

function cartSchema(locale?: string) {
  const zh = locale?.startsWith("zh") ?? false;
  return z.object({
    name: z.string().min(1, zh ? "请填写姓名" : "Name is required"),
    phone: z.string().min(1, zh ? "请填写手机号" : "Phone is required"),
    wechat: z.string().optional(),
    email: z.string().email(zh ? "邮箱格式不正确" : "Invalid email").optional().or(z.literal("")),
    message: z.string().optional(),
    items: z.string(),
    locale: z.string().optional(),
  });
}

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };

export async function submitCart(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const locale = typeof rawData.locale === "string" ? rawData.locale : undefined;
  const parsed = cartSchema(locale).safeParse(rawData);

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let items: Array<{
    projectId?: string;
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
    return { success: false, errors: { items: ["Invalid items"] } };
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/cart-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        wechat: data.wechat || undefined,
        email: data.email || undefined,
        message: data.message || undefined,
        items: items.map((item) => ({
          projectId: item.projectId,
          projectName: item.projectName,
          projectType: item.projectType,
          styleName: item.styleName,
          date: item.date,
          people: item.people,
          price: item.price,
        })),
      }),
    });

    const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiError;

    if (!json.success) {
      return {
        success: false,
        errors: { server: [json.error?.message ?? "Failed to submit. Please try again."] },
      };
    }

    return { success: true, orderId: json.data.id };
  } catch (error) {
    console.error("Cart submission error:", error);
    return { success: false, errors: { server: ["Failed to submit. Please try again."] } };
  }
}
