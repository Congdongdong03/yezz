import { Resend } from "resend";
import type { CartOrderCreateInput } from "../repositories/cart-orders.repository.js";
import type { BookingCreateInput } from "../repositories/bookings.repository.js";
import type {
  EmailOutboxProvider,
  OutboxProviderMessage,
} from "../services/email-outbox.service.js";
import {
  isStatusLifecycleTemplate,
  validateEmailOutboxEnvelope,
  type AdminPasswordSetupOutboxPayload,
  type BookingReceivedOutboxPayload,
  type BookingStatusOutboxPayload,
  type BookingStatusTemplate,
  type CustomerManagePayload,
  type EmailTemplatePayload,
  type OrderReceivedOutboxPayload,
  type OwnerRequestOutboxPayload,
} from "./email-outbox-payload.js";
import { sendSmtpMessage } from "./smtp.js";
import { displayLocalized, escapeHtml } from "./email-helpers.js";

export { displayLocalized, escapeHtml } from "./email-helpers.js";
export type { EmailTemplatePayload } from "./email-outbox-payload.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const configuredFrom = process.env.EMAIL_FROM?.trim();

if (process.env.NODE_ENV === "production" && !configuredFrom) {
  throw new Error("EMAIL_FROM must be configured in production");
}

// Development has no transactional mail configuration by default. Production
// always uses the configured, verified Resend sender instead of a legacy domain.
const FROM = configuredFrom || "YezYY <onboarding@resend.dev>";
const REPLY_TO =
  process.env.EMAIL_REPLY_TO?.trim() || "congdongdong03@gmail.com";

export type StoreContact = {
  phone?: string | null;
  wechatId?: string | null;
  email?: string | null;
};

type ProviderSendResult = { providerMessageId: string };

function providerError(error: unknown): Error {
  const candidate =
    typeof error === "object" && error !== null
      ? (error as { message?: unknown; name?: unknown; statusCode?: unknown })
      : {};
  return Object.assign(
    new Error(
      typeof candidate.message === "string"
        ? candidate.message
        : "Email provider rejected the message",
    ),
    {
      code: typeof candidate.name === "string" ? candidate.name : undefined,
      statusCode:
        typeof candidate.statusCode === "number"
          ? candidate.statusCode
          : undefined,
    },
  );
}

async function sendRawEmail(
  input: { to: string; subject: string; html: string },
  idempotencyKey?: string,
): Promise<ProviderSendResult | null> {
  if (!resend) return null;
  const response = await resend.emails.send(
    {
      from: FROM,
      to: input.to,
      replyTo: REPLY_TO,
      subject: input.subject,
      html: input.html,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (response.error) throw providerError(response.error);
  if (!response.data?.id) {
    throw Object.assign(new Error("Email provider returned no message ID"), {
      code: "missing_provider_message_id",
    });
  }
  return { providerMessageId: response.data.id };
}

export async function sendOwnerEmail(
  subject: string,
  html: string,
): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    return;
  }

  await sendRawEmail({ to: ownerEmail, subject, html });
}

async function sendCustomerEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await sendRawEmail({ to, subject, html });
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

/** Wraps email body content in a branded YezYY HTML shell. */
function brandedEmail(
  title: string,
  body: string,
  locale: string | null | undefined = "en",
): string {
  const documentLanguage = locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
  return `<!DOCTYPE html>
<html lang="${documentLanguage}">
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
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FAF6F1;letter-spacing:2px;font-family:Georgia,serif;">YezYY</h1>
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
              <p style="margin:0;font-size:12px;color:#8A7968;">© ${new Date().getFullYear()} YezYY DIY Studio. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getStoreTimezone(): string {
  return process.env.STORE_TIMEZONE || "Australia/Melbourne";
}

function formatDate(date: Date, locale?: string | null): string {
  const tz = getStoreTimezone();
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
    lines.push(
      `<p style="margin:4px 0;"><strong>电话 / Phone:</strong> ${escapeHtml(contact.phone)}</p>`,
    );
  }
  if (contact.wechatId) {
    lines.push(
      `<p style="margin:4px 0;"><strong>微信 / WeChat:</strong> ${escapeHtml(contact.wechatId)}</p>`,
    );
  }
  if (contact.email) {
    lines.push(
      `<p style="margin:4px 0;"><strong>邮箱 / Email:</strong> ${escapeHtml(contact.email)}</p>`,
    );
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

async function sendCustomerTemplatedEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  locale?: string | null,
): Promise<void> {
  return sendCustomerEmail(
    to,
    subject,
    brandedEmail(subject, bodyHtml, locale),
  );
}

type BookingConfirmationOptions = {
  to: string;
  orderId: string;
  orderNumber: string;
  submittedAt: Date;
  input: BookingCreateInput;
  contact: StoreContact;
};

function renderBookingConfirmation(options: BookingConfirmationOptions): {
  subject: string;
  html: string;
} {
  const { to, orderNumber, submittedAt, input, contact } = options;
  const submitted = formatDate(submittedAt, input.locale);

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">预约申请已收到 / Booking Request Received</h2>
    <p style="color:#5C5C5C;margin:0 0 24px;">您好 <strong>${escapeHtml(input.name.trim())}</strong>，感谢您向 YezYY 提交预约申请。<br/>Thank you for submitting a booking request to YezYY.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
      ${infoRow("订单号 / Order No.", escapeHtml(orderNumber))}
      ${infoRow("提交时间 / Submitted", escapeHtml(submitted))}
      ${input.interestedProject?.trim() ? infoRow("项目 / Project", escapeHtml(input.interestedProject.trim())) : ""}
      ${input.preferredDate?.trim() ? infoRow("日期 / Date", escapeHtml(input.preferredDate.trim())) : ""}
      ${input.numberOfPeople != null ? infoRow("人数 / People", String(input.numberOfPeople)) : ""}
      ${input.activityType?.trim() ? infoRow("活动类型 / Activity", escapeHtml(input.activityType.trim())) : ""}
      ${input.message?.trim() ? infoRow("留言 / Message", escapeHtml(input.message.trim())) : ""}
    </table>
    <p style="margin:24px 0 0;color:#5C5C5C;font-size:14px;">您的申请正在等待人工确认。我们会审核并联系您；无需线上付款，请到店付款。<br/>Your request is awaiting confirmation. We will review it manually and contact you to confirm it. No online payment is required; please Pay in Store.</p>
    ${contactFooter(contact)}
  `;

  const subject = `YezYY Booking Request Received ${orderNumber} / 预约申请已收到`;
  return { subject, html: brandedEmail(subject, body, input.locale) };
}

export async function sendBookingConfirmationToCustomer(
  options: BookingConfirmationOptions,
): Promise<void> {
  const rendered = renderBookingConfirmation(options);
  await sendCustomerEmail(options.to, rendered.subject, rendered.html);
}

type OrderConfirmationOptions = {
  to: string;
  orderNumber: string;
  submittedAt: Date;
  input: CartOrderCreateInput;
  contact: StoreContact;
};

function renderOrderConfirmation(options: OrderConfirmationOptions): {
  subject: string;
  html: string;
} {
  const { orderNumber, submittedAt, input, contact } = options;
  const submitted = formatDate(submittedAt);

  const itemsHtml = input.items
    .map((item, index) => {
      const name = escapeHtml(displayLocalized(item.projectName));
      const style = item.styleName
        ? escapeHtml(displayLocalized(item.styleName))
        : null;
      const detail = style
        ? style
        : escapeHtml(`${item.date || ""} · ${item.people ?? 0} 人`);
      const price = item.price
        ? `<span style="color:#B07D5C;">${escapeHtml(item.price)}</span>`
        : "";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #F0E8E0;font-size:13px;color:#2C2C2C;">${index + 1}. ${name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #F0E8E0;font-size:12px;color:#8A7968;text-align:right;">${detail}${price ? `<br/>${price}` : ""}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">预约申请已收到 / Booking Request Received</h2>
    <p style="color:#5C5C5C;margin:0 0 24px;">您好 <strong>${escapeHtml(input.name.trim())}</strong>，感谢您向 YezYY 提交预约申请。<br/>Thank you for submitting a booking request to YezYY.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
      ${infoRow("订单号 / Order No.", escapeHtml(orderNumber))}
      ${infoRow("提交时间 / Submitted", escapeHtml(submitted))}
    </table>
    <h3 style="margin:24px 0 12px;font-size:14px;color:#8A7968;text-transform:uppercase;letter-spacing:0.5px;">订单摘要 / Order Summary</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
    <p style="margin:24px 0 0;color:#5C5C5C;font-size:14px;">我们会人工审核并联系您确认。无需线上付款，请到店付款。<br/>Your request is awaiting confirmation. We will review it manually and contact you to confirm it. No online payment is required; please Pay in Store.</p>
    ${contactFooter(contact)}
  `;

  const subject = `YezYY Booking Request Received ${orderNumber} / 预约申请已收到`;
  return { subject, html: brandedEmail(subject, body, input.locale) };
}

export async function sendOrderConfirmationToCustomer(
  options: OrderConfirmationOptions,
): Promise<void> {
  const rendered = renderOrderConfirmation(options);
  await sendCustomerEmail(options.to, rendered.subject, rendered.html);
}

function renderBookingNotification(
  payload: CustomerManagePayload,
  locale: string,
): { subject: string; html: string } {
  const zh = locale.toLowerCase().startsWith("zh");
  const copy: Record<
    CustomerManagePayload["template"],
    { en: [string, string]; zh: [string, string] }
  > = {
    booking_confirmed: {
      en: [
        "Booking Confirmed",
        "Your booking is confirmed. We look forward to seeing you.",
      ],
      zh: ["预约已确认", "您的预约已确认，期待您的到来。"],
    },
    booking_rejected: {
      en: [
        "Booking Request Update",
        "We are unable to accept this booking request. Please contact us if you would like help choosing another time.",
      ],
      zh: [
        "预约申请更新",
        "我们目前无法接受此预约申请。如需选择其他时间，请联系我们。",
      ],
    },
    booking_waitlisted: {
      en: [
        "Booking Waitlist",
        "Your request is on the waitlist. This is not a confirmed booking; staff will contact you if a place becomes available.",
      ],
      zh: [
        "预约候补",
        "您的申请已加入候补名单，目前尚未确认。如有空位，工作人员会联系您。",
      ],
    },
    party_time_proposed: {
      en: [
        "Proposed Party Time",
        "Staff have proposed the party time below. Please review it in your booking page. Any venue fee or deposit is paid in store, and staff record it only after confirming payment.",
      ],
      zh: [
        "建议的派对时间",
        "工作人员建议了以下派对时间，请在预约管理页面查看。场地费或订金须到店支付，并由工作人员确认收款后记录。",
      ],
    },
    party_payment_due: {
      en: [
        "Party Venue Fee Due",
        "The venue fee is due by the deadline below. It is paid in store; staff record the venue fee or deposit only after confirming payment.",
      ],
      zh: [
        "派对场地费待支付",
        "请在以下期限前到店支付场地费。场地费或订金由工作人员确认收款后记录。",
      ],
    },
    party_payment_recorded: {
      en: [
        "Party Payment Recorded",
        "Staff have recorded your venue fee after confirming it was paid in store. No online payment was taken.",
      ],
      zh: [
        "派对付款已记录",
        "工作人员已确认您在店内支付的场地费并完成记录，本次未收取线上付款。",
      ],
    },
    party_payment_expired: {
      en: [
        "Party Payment Deadline Expired",
        "The in-store payment deadline has expired and the party time is no longer held. Contact YezYY if you would like staff to review another time.",
      ],
      zh: [
        "派对付款期限已过",
        "到店付款期限已过，派对时间不再保留。如需其他时间，请联系 YezYY 工作人员。",
      ],
    },
    cancellation_request: {
      en: [
        "Cancellation Request Received",
        "We received your cancellation request. Staff will review it; the booking is not cancelled until staff confirm the outcome.",
      ],
      zh: [
        "取消申请已收到",
        "我们已收到您的取消申请，工作人员将进行审核。在工作人员确认处理结果前，预约尚未取消。",
      ],
    },
    reschedule_request: {
      en: [
        "Reschedule Request Received",
        "We received your reschedule request. The requested time is not reserved or confirmed until staff approve it.",
      ],
      zh: [
        "改期申请已收到",
        "我们已收到您的改期申请。在工作人员批准前，新时间尚未保留或确认。",
      ],
    },
    booking_reminder: {
      en: [
        "Booking Reminder",
        "This is a reminder for your confirmed YezYY booking tomorrow.",
      ],
      zh: ["预约提醒", "温馨提醒：您已确认的 YezYY 预约将在明天进行。"],
    },
    staff_notification: {
      en: [
        "Booking Staff Notification",
        "A customer booking action needs staff review.",
      ],
      zh: ["预约工作人员通知", "有一项客户预约操作需要工作人员审核。"],
    },
  };
  const [title, summary] = zh
    ? copy[payload.template].zh
    : copy[payload.template].en;
  const amount =
    payload.amountCents === undefined
      ? ""
      : infoRow(
          zh ? "金额" : "Amount",
          escapeHtml(`$${(payload.amountCents / 100).toFixed(2)} AUD`),
        );
  const deadline = payload.paymentDeadline
    ? infoRow(
        zh ? "付款期限" : "Payment deadline",
        escapeHtml(formatDate(parseOutboxDate(payload.paymentDeadline), locale)),
      )
    : "";
  const note = payload.note
    ? `<p style="background:#FFF8F3;border-left:3px solid #B07D5C;padding:8px 12px;"><strong>${zh ? "备注" : "Note"}:</strong> ${escapeHtml(payload.note)}</p>`
    : "";
  const staffContact =
    payload.template === "staff_notification"
      ? `${payload.customerEmail ? infoRow(zh ? "客户邮箱" : "Customer email", escapeHtml(payload.customerEmail)) : ""}${payload.customerPhone ? infoRow(zh ? "客户电话" : "Customer phone", escapeHtml(payload.customerPhone)) : ""}`
      : "";
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">${escapeHtml(title)}</h2>
    <p style="color:#5C5C5C;margin:0 0 20px;">${escapeHtml(payload.customerName)}${zh ? " 您好，" : ", "}${escapeHtml(summary)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #B07D5C;padding-top:16px;">
      ${infoRow(zh ? "预约编号" : "Booking number", escapeHtml(payload.bookingNumber))}
      ${infoRow(zh ? "项目" : "Offering", escapeHtml(payload.offeringLabel))}
      ${infoRow(zh ? "日期" : "Date", escapeHtml(payload.date))}
      ${infoRow(zh ? "时间" : "Time", escapeHtml(`${payload.startTime}–${payload.endTime}`))}
      ${amount}
      ${deadline}
      ${staffContact}
    </table>
    ${note}
    <p style="margin:24px 0 0;"><a href="${escapeHtml(payload.manageUrl)}" style="display:inline-block;background:#B07D5C;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;">${zh ? "管理预约" : "Manage booking"}</a></p>
    <div style="background:#F4EFE9;border-radius:8px;padding:16px;margin-top:24px;">
      <p style="margin:4px 0;"><strong>${zh ? "店铺" : "Store"}:</strong> ${escapeHtml(payload.storeName)}</p>
      <p style="margin:4px 0;"><strong>${zh ? "邮箱" : "Email"}:</strong> ${escapeHtml(payload.contactEmail)}</p>
      <p style="margin:4px 0;"><strong>${zh ? "电话" : "Phone"}:</strong> ${escapeHtml(payload.contactPhone)}</p>
    </div>
  `;
  const subject = `YezYY ${title} ${payload.bookingNumber}`;
  return { subject, html: brandedEmail(subject, body, locale) };
}

export function renderEmail(input: {
  locale: string;
  payload: EmailTemplatePayload;
}): string {
  const messageType =
    input.payload.template === "booking_received"
      ? "booking_received_customer"
      : input.payload.template === "staff_notification"
        ? "booking_notification_owner"
        : "booking_notification_customer";
  const bookingId =
    input.payload.template === "booking_received"
      ? input.payload.orderId
      : "00000000-0000-4000-8000-000000000001";
  const validated = validateEmailOutboxEnvelope({
    bookingId,
    statusEventId: isStatusLifecycleTemplate(input.payload.template)
      ? "00000000-0000-4000-8000-000000000002"
      : undefined,
    messageType,
    recipient: "render@example.com",
    locale: input.locale,
    payload: input.payload,
  });
  const payload = validated.payload;
  if (payload.template === "booking_received") {
    return renderBookingConfirmation({
      to: "",
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      submittedAt: parseOutboxDate(payload.submittedAt),
      input: payload.input,
      contact: payload.contact,
    }).html;
  }
  if (
    payload.template === "booking_confirmed" ||
    payload.template === "booking_rejected" ||
    payload.template === "booking_waitlisted" ||
    payload.template === "party_time_proposed" ||
    payload.template === "party_payment_due" ||
    payload.template === "party_payment_recorded" ||
    payload.template === "party_payment_expired" ||
    payload.template === "cancellation_request" ||
    payload.template === "reschedule_request" ||
    payload.template === "booking_reminder" ||
    payload.template === "staff_notification"
  ) {
    return renderBookingNotification(payload, validated.locale).html;
  }
  throw Object.assign(new Error("Unsupported email template"), {
    code: "invalid_template_payload",
    statusCode: 422,
  });
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
  const rendered = renderBookingStatusEmail("contacted", ctx);
  await sendCustomerTemplatedEmail(
    ctx.to,
    rendered.subject,
    rendered.body,
    ctx.locale,
  );
}

function renderBookingStatusEmail(
  status: BookingStatusTemplate,
  ctx: BookingStatusEmailContext,
): { subject: string; body: string } {
  const zh = isZh(ctx.locale);
  if (status === "contacted") {
    return {
      subject: zh
        ? `YezYY 预约跟进 ${ctx.orderNumber}`
        : `YezYY booking update ${ctx.orderNumber}`,
      body: zh
        ? `<h2 style="margin:0 0 16px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">预约进度更新</h2>
       <p style="color:#5C5C5C;">${escapeHtml(ctx.customerName)} 您好，我们已查看您的预约（<strong>${escapeHtml(ctx.orderNumber)}</strong>），稍后将联系您确认细节。</p>
       ${contactFooter(ctx.contact)}`
        : `<h2 style="margin:0 0 16px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">Booking Update</h2>
       <p style="color:#5C5C5C;">Hi <strong>${escapeHtml(ctx.customerName)}</strong>, we have reviewed your booking (<strong>${escapeHtml(ctx.orderNumber)}</strong>) and will contact you shortly.</p>
       ${contactFooter(ctx.contact)}`,
    };
  }

  const note = ctx.adminNote?.trim()
    ? `<p style="background:#FFF8F3;border-left:3px solid #B07D5C;padding:8px 12px;margin-top:16px;font-size:13px;"><strong>${zh ? "备注" : "Note"}:</strong> ${escapeHtml(ctx.adminNote)}</p>`
    : "";

  if (status === "confirmed") {
    const when = ctx.slotLabel ?? ctx.preferredDate ?? (zh ? "待确认" : "TBD");
    return {
      subject: zh
        ? `YezYY 预约已确认 ${ctx.orderNumber}`
        : `YezYY booking confirmed ${ctx.orderNumber}`,
      body: zh
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
       ${contactFooter(ctx.contact)}`,
    };
  }

  const statusCopy: Record<
    Exclude<BookingStatusTemplate, "contacted" | "confirmed">,
    { en: [string, string]; zh: [string, string] }
  > = {
    pending_review: {
      en: [
        "Booking Request Awaiting Manual Confirmation",
        "Your request is awaiting manual confirmation. It is not a confirmed booking yet.",
      ],
      zh: [
        "预约申请等待人工确认",
        "您的预约申请正在等待人工确认，目前尚未确认。",
      ],
    },
    waitlisted: {
      en: [
        "Booking Waitlist",
        "Your request is on the waitlist. Staff will contact you if a place becomes available.",
      ],
      zh: ["预约候补", "您的申请已加入候补名单。如有空位，工作人员会联系您。"],
    },
    rejected: {
      en: [
        "Booking Request Not Accepted",
        "We are unable to accept this booking request. Please contact us to discuss another time.",
      ],
      zh: ["预约申请未接受", "我们目前无法接受此预约申请，请联系我们商议其他时间。"],
    },
    reschedule_requested: {
      en: [
        "Reschedule Request Under Review",
        "Your reschedule request is under staff review. The requested time is not reserved or confirmed yet.",
      ],
      zh: ["改期申请等待审核", "您的改期申请正在等待工作人员审核，新时间尚未保留或确认。"],
    },
    cancellation_requested: {
      en: [
        "Cancellation Request Under Review",
        "Your cancellation request is under staff review. The booking is not cancelled until staff confirm the outcome.",
      ],
      zh: ["取消申请等待审核", "您的取消申请正在等待工作人员审核，预约尚未取消。"],
    },
    cancelled: {
      en: ["Booking Cancelled", "Your booking has been cancelled."],
      zh: ["预约已取消", "您的预约已取消。"],
    },
    no_show: {
      en: ["Booking Marked No-show", "This booking was recorded as a no-show."],
      zh: ["预约标记为未到店", "此预约已记录为未到店。"],
    },
    completed: {
      en: ["Booking Completed", "Thank you for visiting YezYY."],
      zh: ["预约已完成", "感谢您到访 YezYY。"],
    },
  };
  const [title, summary] = zh ? statusCopy[status].zh : statusCopy[status].en;
  return {
    subject: `YezYY ${title} ${ctx.orderNumber}`,
    body: `<h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">${escapeHtml(title)}</h2>
       <p style="color:#5C5C5C;margin:0 0 16px;">${escapeHtml(ctx.customerName)}${zh ? " 您好，" : ", "}${escapeHtml(summary)}</p>
       ${infoRow(zh ? "预约编号" : "Booking number", escapeHtml(ctx.orderNumber))}
       ${note}
       ${contactFooter(ctx.contact)}`,
  };
}

export async function sendBookingStatusConfirmedEmail(
  ctx: BookingStatusEmailContext,
): Promise<void> {
  const rendered = renderBookingStatusEmail("confirmed", ctx);
  await sendCustomerTemplatedEmail(
    ctx.to,
    rendered.subject,
    rendered.body,
    ctx.locale,
  );
}

export async function sendBookingStatusCancelledEmail(
  ctx: BookingStatusEmailContext,
): Promise<void> {
  const rendered = renderBookingStatusEmail("cancelled", ctx);
  await sendCustomerTemplatedEmail(
    ctx.to,
    rendered.subject,
    rendered.body,
    ctx.locale,
  );
}

function parseOutboxDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error("Invalid email template date"), {
      code: "invalid_template_payload",
      statusCode: 422,
    });
  }
  return parsed;
}

function renderOutboxMessage(message: OutboxProviderMessage) {
  const validated = validateEmailOutboxEnvelope(message);
  const template = validated.payload.template;
  let rendered: { subject: string; html: string };
  if (template === "booking_status") {
    const payload = validated.payload as BookingStatusOutboxPayload;
    const statusEmail = renderBookingStatusEmail(payload.status, {
      ...payload,
      to: validated.recipient,
      locale: validated.locale,
    });
    rendered = {
      subject: statusEmail.subject,
      html: brandedEmail(
        statusEmail.subject,
        statusEmail.body,
        validated.locale,
      ),
    };
  } else if (template === "booking_received") {
    const payload = validated.payload as BookingReceivedOutboxPayload;
    rendered = renderBookingConfirmation({
      to: validated.recipient,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      submittedAt: parseOutboxDate(payload.submittedAt),
      input: payload.input,
      contact: payload.contact,
    });
  } else if (template === "cart_order_received") {
    const payload = validated.payload as OrderReceivedOutboxPayload;
    rendered = renderOrderConfirmation({
      to: validated.recipient,
      orderNumber: payload.orderNumber,
      submittedAt: parseOutboxDate(payload.submittedAt),
      input: payload.input,
      contact: payload.contact,
    });
  } else if (template === "owner_request") {
    const payload = validated.payload as OwnerRequestOutboxPayload;
    const body = `<h2>${escapeHtml(payload.heading)}</h2><table width="100%" cellpadding="0" cellspacing="0">${payload.fields
      .map((field) =>
        infoRow(escapeHtml(field.label), escapeHtml(field.value)),
      )
      .join("")}</table>`;
    rendered = {
      subject: payload.subject,
      html: brandedEmail(payload.subject, body, validated.locale),
    };
  } else if (template === "admin_password_setup") {
    const payload = validated.payload as AdminPasswordSetupOutboxPayload;
    const subject = "Set up your YezYY Admin password";
    const body = `
      <h2 style="margin:0 0 8px;font-size:20px;color:#2C2C2C;font-family:Georgia,serif;">Set up your password</h2>
      <p style="color:#5C5C5C;margin:0 0 20px;">Hi <strong>${escapeHtml(payload.name)}</strong>, use the secure link below to set the password for ${escapeHtml(payload.email)}.</p>
      <p style="margin:0 0 20px;"><a href="${escapeHtml(payload.setupUrl)}" rel="noreferrer" style="display:inline-block;border-radius:8px;background:#2C2C2C;color:#fff;padding:12px 18px;text-decoration:none;">Set up password</a></p>
      <p style="color:#5C5C5C;font-size:13px;">This single-use link expires in 60 minutes. If you did not expect this email, ignore it.</p>
    `;
    rendered = {
      subject,
      html: brandedEmail(subject, body, validated.locale),
    };
  } else if (
    template === "booking_confirmed" ||
    template === "booking_rejected" ||
    template === "booking_waitlisted" ||
    template === "party_time_proposed" ||
    template === "party_payment_due" ||
    template === "party_payment_recorded" ||
    template === "party_payment_expired" ||
    template === "cancellation_request" ||
    template === "reschedule_request" ||
    template === "booking_reminder" ||
    template === "staff_notification"
  ) {
    rendered = renderBookingNotification(
      validated.payload as CustomerManagePayload,
      validated.locale,
    );
  } else {
    throw Object.assign(new Error("Unsupported email template"), {
      code: "invalid_template_payload",
      statusCode: 422,
    });
  }
  return { validated, rendered };
}

export function createResendOutboxProvider(): EmailOutboxProvider {
  return {
    async send(message: OutboxProviderMessage): Promise<ProviderSendResult> {
      if (!resend) {
        throw Object.assign(new Error("RESEND_API_KEY is not configured"), {
          code: "provider_not_configured",
          statusCode: 503,
        });
      }
      const { validated, rendered } = renderOutboxMessage(message);
      const result = await sendRawEmail(
        {
          to: validated.recipient,
          subject: rendered.subject,
          html: rendered.html,
        },
        message.dedupeKey,
      );
      if (!result) {
        throw Object.assign(new Error("Email provider is not configured"), {
          code: "provider_not_configured",
          statusCode: 503,
        });
      }
      return result;
    },
  };
}

type EmailProviderEnvironment = Partial<
  Record<
    | "NODE_ENV"
    | "EMAIL_PROVIDER"
    | "SMTP_HOST"
    | "SMTP_PORT"
    | "EMAIL_FROM"
    | "EMAIL_REPLY_TO",
    string | undefined
  >
>;

export function createConfiguredOutboxProvider(
  env: EmailProviderEnvironment = process.env,
): EmailOutboxProvider {
  const provider = env.EMAIL_PROVIDER?.trim() || "resend";
  if (provider === "resend") return createResendOutboxProvider();
  if (provider !== "smtp") {
    throw new Error("EMAIL_PROVIDER must be resend or smtp");
  }
  if (env.NODE_ENV !== "test") {
    throw new Error("The SMTP email provider is limited to the test environment");
  }
  const host = env.SMTP_HOST?.trim();
  if (!host || !["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("Test SMTP_HOST must be a loopback address");
  }
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Test SMTP_PORT must be a valid TCP port");
  }
  const from = env.EMAIL_FROM?.trim();
  const replyTo = env.EMAIL_REPLY_TO?.trim();
  if (!from || !replyTo) {
    throw new Error("Test SMTP requires EMAIL_FROM and EMAIL_REPLY_TO");
  }

  return {
    async send(message: OutboxProviderMessage): Promise<ProviderSendResult> {
      const { validated, rendered } = renderOutboxMessage(message);
      await sendSmtpMessage({
        host,
        port,
        from,
        replyTo,
        to: validated.recipient,
        subject: rendered.subject,
        html: rendered.html,
        messageId: message.id,
      });
      return { providerMessageId: `smtp:${message.dedupeKey}` };
    },
  };
}
