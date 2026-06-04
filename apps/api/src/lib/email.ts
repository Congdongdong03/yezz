import { Resend } from "resend";
import type { CartOrderCreateInput } from "../repositories/cart-orders.repository.js";
import type { BookingCreateInput } from "../repositories/bookings.repository.js";
import { displayLocalized, escapeHtml } from "./email-helpers.js";

export { displayLocalized, escapeHtml } from "./email-helpers.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "YEZZ <bookings@yezz.studio>";

export type StoreContact = {
  phone?: string | null;
  wechatId?: string | null;
  email?: string | null;
};

export async function sendOwnerEmail(subject: string, html: string): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!resend || !ownerEmail) {
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject,
    html,
  });
}

async function sendCustomerEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!resend) return;
  await resend.emails.send({ from: FROM, to, subject, html });
}

export function formatBookingOrderId(id: string, createdAt: Date): string {
  const y = createdAt.getUTCFullYear();
  const m = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(createdAt.getUTCDate()).padStart(2, "0");
  const suffix = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `booking-${y}${m}${d}-${suffix}`;
}

export function formatCartOrderId(id: string, createdAt: Date): string {
  const y = createdAt.getUTCFullYear();
  const m = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(createdAt.getUTCDate()).padStart(2, "0");
  const suffix = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `order-${y}${m}${d}-${suffix}`;
}

function contactFooter(contact: StoreContact): string {
  const lines: string[] = [];
  if (contact.phone) {
    lines.push(`<p><strong>电话 / Phone:</strong> ${escapeHtml(contact.phone)}</p>`);
  }
  if (contact.wechatId) {
    lines.push(`<p><strong>微信 / WeChat:</strong> ${escapeHtml(contact.wechatId)}</p>`);
  }
  if (contact.email) {
    lines.push(`<p><strong>邮箱 / Email:</strong> ${escapeHtml(contact.email)}</p>`);
  }
  return lines.join("\n");
}

export async function sendBookingConfirmationToCustomer(options: {
  to: string;
  orderId: string;
  orderNumber: string;
  submittedAt: Date;
  input: BookingCreateInput;
  contact: StoreContact;
}): Promise<void> {
  const { to, orderNumber, submittedAt, input, contact } = options;
  const submitted = submittedAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  const html = `
    <h2>预约已收到 / Booking Received</h2>
    <p>您好 ${escapeHtml(input.name.trim())}，感谢您在 YEZZ 提交预约。</p>
    <p>Thank you for your booking at YEZZ Studio.</p>
    <hr />
    <p><strong>订单号 / Order No.:</strong> ${escapeHtml(orderNumber)}</p>
    <p><strong>提交时间 / Submitted:</strong> ${escapeHtml(submitted)}</p>
    <p><strong>项目 / Project:</strong> ${escapeHtml(input.interestedProject?.trim() || "N/A")}</p>
    <p><strong>日期 / Date:</strong> ${escapeHtml(input.preferredDate?.trim() || "N/A")}</p>
    <p><strong>人数 / People:</strong> ${input.numberOfPeople ?? "N/A"}</p>
    <p><strong>活动类型 / Activity:</strong> ${escapeHtml(input.activityType?.trim() || "N/A")}</p>
    ${input.message?.trim() ? `<p><strong>留言 / Message:</strong> ${escapeHtml(input.message.trim())}</p>` : ""}
    <hr />
    <p>我们将在 <strong>24 小时内</strong>与您联系确认详情。</p>
    <p>We will contact you within <strong>24 hours</strong> to confirm your booking.</p>
    <h3>联系我们 / Contact us</h3>
    ${contactFooter(contact)}
  `;

  await sendCustomerEmail(
    to,
    `YEZZ 预约确认 ${orderNumber} / Booking Confirmation`,
    html,
  );
}

export async function sendOrderConfirmationToCustomer(options: {
  to: string;
  orderNumber: string;
  submittedAt: Date;
  input: CartOrderCreateInput;
  contact: StoreContact;
}): Promise<void> {
  const { orderNumber, submittedAt, input, contact } = options;
  const submitted = submittedAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  const itemsHtml = input.items
    .map((item, index) => {
      const name = escapeHtml(displayLocalized(item.projectName));
      const style = item.styleName ? escapeHtml(displayLocalized(item.styleName)) : null;
      const detail = style
        ? style
        : escapeHtml(`${item.date || ""} / ${item.people ?? 0} people`);
      const price = escapeHtml(item.price || "N/A");
      return `<p>${index + 1}. ${name} — ${detail} — ${price}</p>`;
    })
    .join("");

  const html = `
    <h2>订单已收到 / Order Received</h2>
    <p>您好 ${escapeHtml(input.name.trim())}，感谢您在 YEZZ 提交订单。</p>
    <p>Thank you for your order at YEZZ Studio.</p>
    <hr />
    <p><strong>订单号 / Order No.:</strong> ${escapeHtml(orderNumber)}</p>
    <p><strong>提交时间 / Submitted:</strong> ${escapeHtml(submitted)}</p>
    <h3>订单摘要 / Order summary</h3>
    ${itemsHtml}
    <hr />
    <p>我们将在 <strong>24 小时内</strong>与您联系确认详情。</p>
    <p>We will contact you within <strong>24 hours</strong> to confirm your order.</p>
    <h3>联系我们 / Contact us</h3>
    ${contactFooter(contact)}
  `;

  await sendCustomerEmail(
    options.to,
    `YEZZ 订单确认 ${orderNumber} / Order Confirmation`,
    html,
  );
}
