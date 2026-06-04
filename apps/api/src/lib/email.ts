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

/** Wraps email body content in a branded YEZZ HTML shell. */
function brandedEmail(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:#B07D5C;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FAF6F1;letter-spacing:2px;font-family:Georgia,serif;">YEZZ</h1>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(250,246,241,0.75);letter-spacing:1px;text-transform:uppercase;">DIY Studio</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F4EFE9;padding:20px 32px;text-align:center;border-top:1px solid #E8DDD4;">
              <p style="margin:0;font-size:12px;color:#8A7968;">© ${new Date().getFullYear()} YEZZ DIY Studio. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const STORE_TIMEZONE = process.env.STORE_TIMEZONE || "Australia/Sydney";

function formatDate(date: Date, locale?: string | null): string {
  const tz = STORE_TIMEZONE;
  const lang = locale?.toLowerCase().startsWith("zh") ? "zh-CN" : "en-AU";
  return date.toLocaleString(lang, {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function contactFooter(contact: StoreContact): string {
  const lines: string[] = [];
  if (contact.phone) {
    lines.push(`<p style="margin:4px 0;"><strong>电话 / Phone:</strong> ${escapeHtml(contact.phone)}</p>`);
  }
  if (contact.wechatId) {
    lines.push(`<p style="margin:4px 0;"><strong>微信 / WeChat:</strong> ${escapeHtml(contact.wechatId)}</p>`);
  }
  if (contact.email) {
    lines.push(`<p style="margin:4px 0;"><strong>邮箱 / Email:</strong> ${escapeHtml(contact.email)}</p>`);
  }
  return lines.length
    ? `<div style="background:#F4EFE9;border-radius:8px;padding:16px;margin-top:24px;">${lines.join("")}</div>`
    : "";
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#8A7968;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:6px 0 6px 16px;color:#2C2C2C;font-size:13px;vertical-align:top;">${value}</td>
  </tr>`;
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
  const submitted = formatDate(submittedAt, input.locale);

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">预约已收到 / Booking Received</h2>
    <p style="color:#5C5C5C;margin:0 0 24px;">您好 <strong>${escapeHtml(input.name.trim())}</strong>，感谢您在 YEZZ 提交预约。<br/>Thank you for your booking at YEZZ Studio.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
      ${infoRow("订单号 / Order No.", escapeHtml(orderNumber))}
      ${infoRow("提交时间 / Submitted", escapeHtml(submitted))}
      ${input.interestedProject?.trim() ? infoRow("项目 / Project", escapeHtml(input.interestedProject.trim())) : ""}
      ${input.preferredDate?.trim() ? infoRow("日期 / Date", escapeHtml(input.preferredDate.trim())) : ""}
      ${input.numberOfPeople != null ? infoRow("人数 / People", String(input.numberOfPeople)) : ""}
      ${input.activityType?.trim() ? infoRow("活动类型 / Activity", escapeHtml(input.activityType.trim())) : ""}
      ${input.message?.trim() ? infoRow("留言 / Message", escapeHtml(input.message.trim())) : ""}
    </table>
    <p style="margin:24px 0 0;color:#5C5C5C;font-size:14px;">我们将在 <strong>24 小时内</strong>与您联系确认详情。<br/>We will contact you within <strong>24 hours</strong>.</p>
    ${contactFooter(contact)}
  `;

  await sendCustomerEmail(
    to,
    `YEZZ 预约确认 ${orderNumber} / Booking Confirmation`,
    brandedEmail(`YEZZ 预约确认 ${orderNumber}`, body),
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
  const submitted = formatDate(submittedAt);

  const itemsHtml = input.items
    .map((item, index) => {
      const name = escapeHtml(displayLocalized(item.projectName));
      const style = item.styleName ? escapeHtml(displayLocalized(item.styleName)) : null;
      const detail = style ? style : escapeHtml(`${item.date || ""} · ${item.people ?? 0} 人`);
      const price = item.price ? `<span style="color:#B07D5C;">${escapeHtml(item.price)}</span>` : "";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #F0E8E0;font-size:13px;color:#2C2C2C;">${index + 1}. ${name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #F0E8E0;font-size:12px;color:#8A7968;text-align:right;">${detail}${price ? `<br/>${price}` : ""}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">订单已收到 / Order Received</h2>
    <p style="color:#5C5C5C;margin:0 0 24px;">您好 <strong>${escapeHtml(input.name.trim())}</strong>，感谢您在 YEZZ 提交订单。<br/>Thank you for your order at YEZZ Studio.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
      ${infoRow("订单号 / Order No.", escapeHtml(orderNumber))}
      ${infoRow("提交时间 / Submitted", escapeHtml(submitted))}
    </table>
    <h3 style="margin:24px 0 12px;font-size:14px;color:#8A7968;text-transform:uppercase;letter-spacing:0.5px;">订单摘要 / Order Summary</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
    <p style="margin:24px 0 0;color:#5C5C5C;font-size:14px;">我们将在 <strong>24 小时内</strong>与您联系确认详情。<br/>We will contact you within <strong>24 hours</strong>.</p>
    ${contactFooter(contact)}
  `;

  await sendCustomerEmail(
    options.to,
    `YEZZ 订单确认 ${orderNumber} / Order Confirmation`,
    brandedEmail(`YEZZ 订单确认 ${orderNumber}`, body),
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
  const subject = zh ? `YEZZ 预约跟进 ${ctx.orderNumber}` : `YEZZ booking update ${ctx.orderNumber}`;
  const body = zh
    ? `<h2 style="margin:0 0 16px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">预约进度更新</h2>
       <p style="color:#5C5C5C;">${escapeHtml(ctx.customerName)} 您好，我们已查看您的预约（<strong>${escapeHtml(ctx.orderNumber)}</strong>），稍后将联系您确认细节。</p>
       ${contactFooter(ctx.contact)}`
    : `<h2 style="margin:0 0 16px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">Booking Update</h2>
       <p style="color:#5C5C5C;">Hi <strong>${escapeHtml(ctx.customerName)}</strong>, we have reviewed your booking (<strong>${escapeHtml(ctx.orderNumber)}</strong>) and will contact you shortly.</p>
       ${contactFooter(ctx.contact)}`;
  await sendCustomerEmail(ctx.to, subject, brandedEmail(subject, body));
}

export async function sendBookingStatusConfirmedEmail(
  ctx: BookingStatusEmailContext,
): Promise<void> {
  const zh = isZh(ctx.locale);
  const when = ctx.slotLabel ?? ctx.preferredDate ?? (zh ? "待确认" : "TBD");
  const subject = zh ? `YEZZ 预约已确认 ${ctx.orderNumber}` : `YEZZ booking confirmed ${ctx.orderNumber}`;
  const note = ctx.adminNote?.trim()
    ? `<p style="background:#FFF8F3;border-left:3px solid #B07D5C;padding:8px 12px;margin-top:16px;font-size:13px;"><strong>${zh ? "备注" : "Note"}:</strong> ${escapeHtml(ctx.adminNote)}</p>`
    : "";

  const body = zh
    ? `<h2 style="margin:0 0 8px;font-size:20px;color:#B07D5C;font-family:Georgia,serif;">✓ 预约已确认</h2>
       <p style="color:#5C5C5C;margin:0 0 24px;">${escapeHtml(ctx.customerName)} 您好，您的预约已成功确认！</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
         ${infoRow("订单号", escapeHtml(ctx.orderNumber))}
         ${infoRow("时间", escapeHtml(when))}
         ${ctx.address ? infoRow("地址", escapeHtml(ctx.address)) : ""}
         ${ctx.businessHours ? infoRow("营业时间", escapeHtml(ctx.businessHours)) : ""}
       </table>
       ${note}
       ${contactFooter(ctx.contact)}`
    : `<h2 style="margin:0 0 8px;font-size:20px;color:#B07D5C;font-family:Georgia,serif;">✓ Booking Confirmed</h2>
       <p style="color:#5C5C5C;margin:0 0 24px;">Hi <strong>${escapeHtml(ctx.customerName)}</strong>, your booking is confirmed!</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
         ${infoRow("Order No.", escapeHtml(ctx.orderNumber))}
         ${infoRow("When", escapeHtml(when))}
         ${ctx.address ? infoRow("Address", escapeHtml(ctx.address)) : ""}
         ${ctx.businessHours ? infoRow("Hours", escapeHtml(ctx.businessHours)) : ""}
       </table>
       ${note}
       ${contactFooter(ctx.contact)}`;
  await sendCustomerEmail(ctx.to, subject, brandedEmail(subject, body));
}

export async function sendBookingStatusCancelledEmail(
  ctx: BookingStatusEmailContext,
): Promise<void> {
  const zh = isZh(ctx.locale);
  const subject = zh ? `YEZZ 预约取消 ${ctx.orderNumber}` : `YEZZ booking cancelled ${ctx.orderNumber}`;
  const reason = ctx.adminNote?.trim()
    ? escapeHtml(ctx.adminNote)
    : zh ? "档期已满或时间冲突" : "schedule conflict or capacity limit";

  const body = zh
    ? `<h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">预约未能安排</h2>
       <p style="color:#5C5C5C;margin:0 0 16px;">${escapeHtml(ctx.customerName)} 您好，很遗憾您的预约（<strong>${escapeHtml(ctx.orderNumber)}</strong>）目前无法安排。</p>
       <p style="background:#FFF5F5;border-left:3px solid #E07070;padding:8px 12px;font-size:13px;"><strong>原因：</strong> ${reason}</p>
       <p style="margin-top:16px;color:#5C5C5C;">欢迎联系我们重新预约。</p>
       ${contactFooter(ctx.contact)}`
    : `<h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">Booking Unavailable</h2>
       <p style="color:#5C5C5C;margin:0 0 16px;">Hi <strong>${escapeHtml(ctx.customerName)}</strong>, we are unable to accommodate your booking (<strong>${escapeHtml(ctx.orderNumber)}</strong>) at this time.</p>
       <p style="background:#FFF5F5;border-left:3px solid #E07070;padding:8px 12px;font-size:13px;"><strong>Reason:</strong> ${reason}</p>
       <p style="margin-top:16px;color:#5C5C5C;">Please contact us to reschedule.</p>
       ${contactFooter(ctx.contact)}`;
  await sendCustomerEmail(ctx.to, subject, brandedEmail(subject, body));
}

export async function sendStaffWelcomeEmail(options: {
  to: string;
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<void> {
  const subject = "YEZZ Admin — Your Account / 账号已开通";
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">Welcome to YEZZ Admin / 欢迎使用后台</h2>
    <p style="color:#5C5C5C;margin:0 0 24px;">
      Hi <strong>${escapeHtml(options.name)}</strong>, your admin account has been created.<br/>
      您好，您的后台账号已开通。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
      ${infoRow("Email / 邮箱", escapeHtml(options.email))}
      ${infoRow("Password / 初始密码", escapeHtml(options.password))}
      ${infoRow("Role / 角色", escapeHtml(options.role))}
    </table>
    <p style="margin-top:24px;color:#E07070;font-size:13px;">⚠ Please change your password immediately after first login. / 请登录后立即修改密码。</p>
  `;
  await sendCustomerEmail(options.to, subject, brandedEmail(subject, body));
}
