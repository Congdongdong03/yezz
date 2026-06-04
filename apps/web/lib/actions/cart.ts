"use server";

import { z } from "zod";
import { Resend } from "resend";

const cartSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  wechat: z.string().optional(),
  message: z.string().optional(),
  items: z.string(),
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitCart(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = cartSchema.safeParse(rawData);

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let items: Array<{
    projectId?: string;
    projectName?: { en?: string } | string;
    projectType?: string;
    styleName?: { en?: string } | string;
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
    const itemsHtml = items
      .map((item, i) => {
        const name =
          typeof item.projectName === "string"
            ? item.projectName
            : item.projectName?.en;
        const style =
          typeof item.styleName === "string"
            ? item.styleName
            : item.styleName?.en;
        return `<p>${i + 1}. ${name} — ${style || `${item.date || ""} / ${item.people || 0} people`} — ${item.price || "N/A"}</p>`;
      })
      .join("");

    if (process.env.RESEND_API_KEY && process.env.OWNER_EMAIL) {
      await resend.emails.send({
        from: "YEZZ <bookings@yezz.studio>",
        to: process.env.OWNER_EMAIL,
        subject: `New Order from ${data.name}`,
        html: `
        <h2>New Order Received</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>WeChat:</strong> ${data.wechat || "N/A"}</p>
        <p><strong>Note:</strong> ${data.message || "N/A"}</p>
        <h3>Items:</h3>
        ${itemsHtml}
      `,
      });
    }

    return { success: true, orderId: `email-${Date.now()}` };
  } catch (error) {
    console.error("Cart submission error:", error);
    return { success: false, errors: { server: ["Failed to submit. Please try again."] } };
  }
}
