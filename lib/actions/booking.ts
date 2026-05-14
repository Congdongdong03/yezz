"use server";

import { z } from "zod";
import { client } from "@/lib/sanity/client";
import { Resend } from "resend";

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
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitBooking(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = bookingSchema.safeParse(rawData);

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  try {
    // Save to Sanity
    const booking = await client.create({
      _type: "booking",
      name: data.name,
      phone: data.phone,
      wechat: data.wechat || "",
      email: data.email || "",
      preferredDate: data.preferredDate || "",
      numberOfPeople: parseInt(data.numberOfPeople || "0"),
      activityType: data.activityType || "",
      interestedProject: data.interestedProject || "",
      message: data.message || "",
      status: "new",
      submittedAt: new Date().toISOString(),
    });

    // Send email to owner
    await resend.emails.send({
      from: "YEZZ <bookings@yezz.studio>",
      to: process.env.OWNER_EMAIL || "",
      subject: `New Booking from ${data.name}`,
      html: `
        <h2>New Booking Received</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>WeChat:</strong> ${data.wechat || "N/A"}</p>
        <p><strong>Email:</strong> ${data.email || "N/A"}</p>
        <p><strong>Date:</strong> ${data.preferredDate || "N/A"}</p>
        <p><strong>People:</strong> ${data.numberOfPeople || "N/A"}</p>
        <p><strong>Type:</strong> ${data.activityType || "N/A"}</p>
        <p><strong>Project:</strong> ${data.interestedProject || "N/A"}</p>
        <p><strong>Message:</strong> ${data.message || "N/A"}</p>
      `,
    });

    return { success: true, bookingId: booking._id };
  } catch (error) {
    console.error("Booking submission error:", error);
    return { success: false, errors: { server: ["Failed to submit booking. Please try again."] } };
  }
}
