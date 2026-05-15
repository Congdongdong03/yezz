"use server";

import { z } from "zod";
import { client } from "@/lib/sanity/client";
import { Resend } from "resend";

const cartSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  wechat: z.string().optional(),
  message: z.string().optional(),
  items: z.string(), // JSON string of CartItem[]
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitCart(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = cartSchema.safeParse(rawData);

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let items: any[] = [];
  try {
    items = JSON.parse(data.items);
  } catch {
    return { success: false, errors: { items: ["Invalid items"] } };
  }

  try {
    const order = await client.create({
      _type: "cartOrder",
      name: data.name,
      phone: data.phone,
      wechat: data.wechat || "",
      message: data.message || "",
      items: items.map((item) => ({
        projectId: item.projectId,
        projectName: item.projectName?.en || item.projectName,
        projectType: item.projectType,
        styleName: item.styleName?.en || item.styleName || "",
        date: item.date || "",
        people: item.people || 0,
        price: item.price || "",
      })),
      status: "new",
      submittedAt: new Date().toISOString(),
    });

    const itemsHtml = items
      .map(
        (item, i) =>
          `<p>${i + 1}. ${item.projectName?.en || item.projectName} — ${
            item.styleName?.en || item.styleName || item.date + " / " + item.people + " people"
          } — ${item.price || "N/A"}</p>`
      )
      .join("");

    await resend.emails.send({
      from: "YEZZ <bookings@yezz.studio>",
      to: process.env.OWNER_EMAIL || "",
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

    return { success: true, orderId: order._id };
  } catch (error) {
    console.error("Cart submission error:", error);
    return { success: false, errors: { server: ["Failed to submit. Please try again."] } };
  }
}
