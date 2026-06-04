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

function formatOrderId(prefix: string, id: string, createdAt: Date): string {
  const y = createdAt.getUTCFullYear();
  const m = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(createdAt.getUTCDate()).padStart(2, "0");
  const suffix = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `${prefix}-${y}${m}${d}-${suffix}`;
}

export function formatBookingOrderId(id: string, createdAt: Date): string {
  return formatOrderId("booking", id, createdAt);
}

export function formatCartOrderId(id: string, createdAt: Date): string {
  return formatOrderId("order", id, createdAt);
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

export type BookingStatusEmailContext = {
  to: string;
  locale?: string | null;
  customerName: string;
  orderNumber: string;
  preferredDate?: string | null;
  slotLabel?: string | null;
  storeName: string;
  address?: string | null;
  businessHours?: string | null;
  contact: StoreContact;
  adminNote?: string | null;
};

function isZh(locale?: string | null) {
  return locale?.toLowerCase().startsWith("zh") ?? true;
}

export async function sendBookingStatusContactedEmail(
  ctx: BookingStatusEmailContext,
): Promise<void> {
  const zh = isZh(ctx.locale);
  const html = zh
    ? `
    <h2>预约进度更新</h2>
    <p>${escapeHtml(ctx.customerName)} 您好，我们已查看您的预约（${escapeHtml(ctx.orderNumber)}），稍后将联系您确认细节。</p>
    ${contactFooter(ctx.contact)}
  `
    : `
    <h2>Booking update</h2>
    <p>Hi ${escapeHtml(ctx.customerName)}, we have reviewed your booking (${escapeHtml(ctx.orderNumber)}) and will contact you shortly to confirm the details.</p>
    ${contactFooter(ctx.contact)}
  `;
  await sendCustomerEmail(
    ctx.to,
    zh ? `YEZZ 预约跟进 ${ctx.orderNumber}` : `YEZZ booking update ${ctx.orderNumber}`,
    html,
  );
}

export async function sendBookingStatusConfirmedEmail(
  ctx: BookingStatusEmailContext,
): Promise<void> {
  const zh = isZh(ctx.locale);
  const when = ctx.slotLabel ?? ctx.preferredDate ?? (zh ? "待确认" : "TBD");
  const note = ctx.adminNote?.trim()
    ? `<p><strong>${zh ? "备注" : "Note"}:</strong> ${escapeHtml(ctx.adminNote)}</p>`
    : "";
  const html = zh
    ? `
    <h2>预约已确认</h2>
    <p>${escapeHtml(ctx.customerName)} 您好，您的预约已确认！</p>
    <p><strong>订单号：</strong> ${escapeHtml(ctx.orderNumber)}</p>
    <p><strong>时间：</strong> ${escapeHtml(when)}</p>
    <p><strong>地址：</strong> ${escapeHtml(ctx.address ?? "请见店铺联系方式")}</p>
    <p><strong>营业时间：</strong> ${escapeHtml(ctx.businessHours ?? "—")}</p>
    ${note}
    ${contactFooter(ctx.contact)}
  `
    : `
    <h2>Booking confirmed</h2>
    <p>Hi ${escapeHtml(ctx.customerName)}, your booking is confirmed!</p>
    <p><strong>Order:</strong> ${escapeHtml(ctx.orderNumber)}</p>
    <p><strong>When:</strong> ${escapeHtml(when)}</p>
    <p><strong>Address:</strong> ${escapeHtml(ctx.address ?? "See contact details below")}</p>
    <p><strong>Hours:</strong> ${escapeHtml(ctx.businessHours ?? "—")}</p>
    ${note}
    ${contactFooter(ctx.contact)}
  `;
  await sendCustomerEmail(
    ctx.to,
    zh ? `YEZZ 预约已确认 ${ctx.orderNumber}` : `YEZZ booking confirmed ${ctx.orderNumber}`,
    html,
  );
}

export async function sendBookingStatusCancelledEmail(
  ctx: BookingStatusEmailContext,
): Promise<void> {
  const zh = isZh(ctx.locale);
  const reason = ctx.adminNote?.trim()
    ? escapeHtml(ctx.adminNote)
    : zh
      ? "档期已满或时间冲突"
      : "schedule conflict or capacity limit";
  const html = zh
    ? `
    <h2>预约未能安排</h2>
    <p>${escapeHtml(ctx.customerName)} 您好，很遗憾您的预约（${escapeHtml(ctx.orderNumber)}）目前无法安排。</p>
    <p><strong>原因：</strong> ${reason}</p>
    <p>欢迎联系我们重新预约。</p>
    ${contactFooter(ctx.contact)}
  `
    : `
    <h2>Booking unavailable</h2>
    <p>Hi ${escapeHtml(ctx.customerName)}, we are unable to accommodate your booking (${escapeHtml(ctx.orderNumber)}) at this time.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>Please contact us to reschedule.</p>
    ${contactFooter(ctx.contact)}
  `;
  await sendCustomerEmail(
    ctx.to,
    zh ? `YEZZ 预约取消 ${ctx.orderNumber}` : `YEZZ booking cancelled ${ctx.orderNumber}`,
    html,
  );
}

export async function sendStaffWelcomeEmail(options: {
  to: string;
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<void> {
  const html = `
    <h2>YEZZ Admin 账号已创建</h2>
    <p>您好 ${escapeHtml(options.name)}，您的后台账号已开通。</p>
    <p><strong>邮箱：</strong> ${escapeHtml(options.email)}</p>
    <p><strong>初始密码：</strong> ${escapeHtml(options.password)}</p>
    <p><strong>角色：</strong> ${escapeHtml(options.role)}</p>
    <p>请登录后立即修改密码。</p>
  `;
  await sendCustomerEmail(options.to, "YEZZ Admin 账号信息", html);
}
