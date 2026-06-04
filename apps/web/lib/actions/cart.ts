"use server";

import { z } from "zod";
import { getApiBaseUrl } from "@/lib/api/config";

const cartSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  wechat: z.string().optional(),
  message: z.string().optional(),
  items: z.string(),
});

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };

export async function submitCart(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = cartSchema.safeParse(rawData);

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
