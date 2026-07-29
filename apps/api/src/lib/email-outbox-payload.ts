import type { BookingCreateInput } from "../repositories/bookings.repository.js";
import type { CartOrderCreateInput } from "../repositories/cart-orders.repository.js";
import { AppError } from "./errors.js";

type StoreContactPayload = {
  phone?: string | null;
  wechatId?: string | null;
  email?: string | null;
};

export const CANONICAL_BOOKING_EMAIL_IDENTITY = {
  storeName: "YezYY",
  contactEmail: "congdongdong03@gmail.com",
  contactPhone: "0430 787 712",
} as const;

export type CanonicalBookingContactPayload = {
  phone: typeof CANONICAL_BOOKING_EMAIL_IDENTITY.contactPhone;
  wechatId?: string | null;
  email: typeof CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail;
};

export type BookingStatusTemplate =
  | "contacted"
  | "pending_review"
  | "confirmed"
  | "waitlisted"
  | "rejected"
  | "reschedule_requested"
  | "cancellation_requested"
  | "cancelled"
  | "no_show"
  | "completed";

export type BookingStatusOutboxPayload = {
  template: "booking_status";
  status: BookingStatusTemplate;
  locale?: string | null;
  customerName: string;
  orderNumber: string;
  preferredDate?: string | null;
  slotLabel?: string | null;
  storeName: typeof CANONICAL_BOOKING_EMAIL_IDENTITY.storeName;
  address?: string | null;
  businessHours?: string | null;
  contact: CanonicalBookingContactPayload;
  adminNote?: string | null;
};

export type BookingReceivedOutboxPayload = {
  template: "booking_received";
  storeName: typeof CANONICAL_BOOKING_EMAIL_IDENTITY.storeName;
  orderId: string;
  orderNumber: string;
  submittedAt: string;
  input: BookingCreateInput;
  contact: CanonicalBookingContactPayload;
};

export type OrderReceivedOutboxPayload = {
  template: "cart_order_received";
  orderNumber: string;
  submittedAt: string;
  input: CartOrderCreateInput;
  contact: StoreContactPayload;
};

export type OwnerRequestOutboxPayload = {
  template: "owner_request";
  subject: string;
  heading: string;
  fields: Array<{ label: string; value: string }>;
};

export type AdminPasswordSetupOutboxPayload = {
  template: "admin_password_setup";
  name: string;
  email: string;
  role: "owner" | "admin" | "staff";
  setupUrl: string;
  expiresAt: string;
};

export type BookingNotificationTemplate =
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_waitlisted"
  | "party_time_proposed"
  | "party_payment_due"
  | "party_payment_recorded"
  | "party_payment_expired"
  | "party_rejected"
  | "party_cancelled"
  | "cancellation_request"
  | "reschedule_request"
  | "booking_reminder"
  | "staff_notification";

export const LIFECYCLE_TEMPLATE_STATUS = {
  booking_confirmed: "confirmed",
  booking_rejected: "rejected",
  booking_waitlisted: "waitlisted",
  party_time_proposed: "time_proposed",
  party_payment_due: "awaiting_in_store_payment",
  party_payment_recorded: "confirmed_paid",
  party_payment_expired: "payment_expired",
  party_rejected: "rejected",
  party_cancelled: "cancelled",
  cancellation_request: "cancellation_requested",
  reschedule_request: "reschedule_requested",
} as const;

export function isStatusLifecycleTemplate(
  template: string,
): template is keyof typeof LIFECYCLE_TEMPLATE_STATUS {
  return Object.hasOwn(LIFECYCLE_TEMPLATE_STATUS, template);
}

export type CustomerManagePayload = {
  template: BookingNotificationTemplate;
  customerName: string;
  bookingNumber: string;
  offeringLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  manageUrl: string;
  storeName: "YezYY";
  contactEmail: "congdongdong03@gmail.com";
  contactPhone: "0430 787 712";
  paymentDeadline?: string;
  amountCents?: 9500 | 14500;
  note?: string;
  customerEmail?: string;
  customerPhone?: string;
};

export type BookingReminderPayload = CustomerManagePayload & {
  template: "booking_reminder";
};

export type PartyPaymentPayload = CustomerManagePayload & {
  template:
    | "party_payment_due"
    | "party_payment_recorded"
    | "party_payment_expired";
  amountCents: 9500 | 14500;
  paymentDeadline?: string;
};

export type EmailTemplatePayload =
  | BookingStatusOutboxPayload
  | BookingReceivedOutboxPayload
  | OrderReceivedOutboxPayload
  | OwnerRequestOutboxPayload
  | AdminPasswordSetupOutboxPayload
  | CustomerManagePayload;

export type EmailOutboxEnvelope = {
  bookingId?: string | null;
  cartOrderId?: string | null;
  statusEventId?: string | null;
  messageType: string;
  recipient: string;
  locale: string;
  payload: unknown;
};

export type ValidatedEmailOutboxEnvelope = Omit<
  EmailOutboxEnvelope,
  "payload"
> & {
  bookingId: string | null;
  cartOrderId: string | null;
  statusEventId: string | null;
  messageType: EmailMessageType;
  recipient: string;
  locale: string;
  payload: EmailTemplatePayload;
};

export type EmailMessageType =
  | "booking_received_customer"
  | "booking_received_owner"
  | "cart_order_received_customer"
  | "cart_order_received_owner"
  | "booking_status_customer"
  | "cart_order_status_customer"
  | "booking_notification_customer"
  | "booking_notification_owner"
  | "admin_password_setup";

type PlainRecord = Record<string, unknown>;

function invalid(message: string): never {
  throw new AppError(422, "INVALID_EMAIL_PAYLOAD", message);
}

function record(
  value: unknown,
  field: string,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = [],
): PlainRecord {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid(`${field} must be an object`);
  }
  const result = value as PlainRecord;
  for (const key of Object.keys(result)) {
    if (!allowedKeys.includes(key)) invalid(`${field}.${key} is not allowed`);
  }
  for (const key of requiredKeys) {
    if (!(key in result)) invalid(`${field}.${key} is required`);
  }
  return result;
}

function stringValue(
  value: unknown,
  field: string,
  options: { max?: number; nullable?: boolean } = {},
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && options.nullable) return null;
  if (typeof value !== "string") invalid(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) invalid(`${field} must not be empty`);
  if (trimmed.length > (options.max ?? 5000)) {
    invalid(`${field} is too long`);
  }
  return trimmed;
}

function optionalInteger(value: unknown, field: string): void {
  if (value == null) return;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    invalid(`${field} must be a non-negative integer`);
  }
}

function localizedString(value: unknown, field: string): void {
  if (value == null || typeof value === "string") {
    if (typeof value === "string") stringValue(value, field, { max: 255 });
    return;
  }
  const localized = record(value, field, ["en", "zh"]);
  if (localized.en === undefined && localized.zh === undefined) {
    invalid(`${field} requires en or zh`);
  }
  if (localized.en !== undefined)
    stringValue(localized.en, `${field}.en`, { max: 255 });
  if (localized.zh !== undefined)
    stringValue(localized.zh, `${field}.zh`, { max: 255 });
}

function contact(value: unknown, field = "payload.contact"): void {
  const candidate = record(value, field, ["phone", "wechatId", "email"]);
  for (const key of ["phone", "wechatId", "email"] as const) {
    stringValue(candidate[key], `${field}.${key}`, {
      max: key === "email" ? 255 : 128,
      nullable: true,
    });
  }
}

function canonicalBookingContact(
  value: unknown,
  field = "payload.contact",
): void {
  const candidate = record(
    value,
    field,
    ["phone", "wechatId", "email"],
    ["phone", "email"],
  );
  if (
    candidate.phone !== CANONICAL_BOOKING_EMAIL_IDENTITY.contactPhone
  ) {
    invalid(
      `${field}.phone must be ${CANONICAL_BOOKING_EMAIL_IDENTITY.contactPhone}`,
    );
  }
  if (
    candidate.email !== CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail
  ) {
    invalid(
      `${field}.email must be ${CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail}`,
    );
  }
  stringValue(candidate.wechatId, `${field}.wechatId`, {
    max: 128,
    nullable: true,
  });
}

function dateString(value: unknown, field: string): void {
  const text = stringValue(value, field, { max: 64 });
  if (!text || Number.isNaN(new Date(text).getTime())) {
    invalid(`${field} must be a valid date`);
  }
}

function calendarDate(value: unknown, field: string): void {
  const text = stringValue(value, field, { max: 10 });
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    invalid(`${field} must use YYYY-MM-DD`);
  }
}

function clockTime(value: unknown, field: string): void {
  const text = stringValue(value, field, { max: 5 });
  if (!text || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    invalid(`${field} must use HH:MM`);
  }
}

function httpUrl(value: unknown, field: string): void {
  const text = stringValue(value, field, { max: 2048 });
  if (!text) invalid(`${field} must be an http(s) URL`);
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      invalid(`${field} must be an http(s) URL`);
    }
  } catch {
    invalid(`${field} must be an http(s) URL`);
  }
}

const BOOKING_NOTIFICATION_TEMPLATES = new Set<BookingNotificationTemplate>([
  "booking_confirmed",
  "booking_rejected",
  "booking_waitlisted",
  "party_time_proposed",
  "party_payment_due",
  "party_payment_recorded",
  "party_payment_expired",
  "party_rejected",
  "party_cancelled",
  "cancellation_request",
  "reschedule_request",
  "booking_reminder",
  "staff_notification",
]);

function bookingNotification(value: unknown): CustomerManagePayload {
  const candidate = record(
    value,
    "payload",
    [
      "template",
      "customerName",
      "bookingNumber",
      "offeringLabel",
      "date",
      "startTime",
      "endTime",
      "manageUrl",
      "storeName",
      "contactEmail",
      "contactPhone",
      "paymentDeadline",
      "amountCents",
      "note",
      "customerEmail",
      "customerPhone",
    ],
    [
      "template",
      "customerName",
      "bookingNumber",
      "offeringLabel",
      "date",
      "startTime",
      "endTime",
      "manageUrl",
      "storeName",
      "contactEmail",
      "contactPhone",
    ],
  );
  if (
    !BOOKING_NOTIFICATION_TEMPLATES.has(
      candidate.template as BookingNotificationTemplate,
    )
  ) {
    invalid("payload.template is invalid");
  }
  for (const key of [
    "customerName",
    "bookingNumber",
    "offeringLabel",
  ] as const) {
    stringValue(candidate[key], `payload.${key}`, { max: 255 });
  }
  calendarDate(candidate.date, "payload.date");
  clockTime(candidate.startTime, "payload.startTime");
  clockTime(candidate.endTime, "payload.endTime");
  httpUrl(candidate.manageUrl, "payload.manageUrl");
  if (candidate.storeName !== "YezYY") {
    invalid("payload.storeName must be YezYY");
  }
  if (candidate.contactEmail !== "congdongdong03@gmail.com") {
    invalid("payload.contactEmail must be congdongdong03@gmail.com");
  }
  if (candidate.contactPhone !== "0430 787 712") {
    invalid("payload.contactPhone must be 0430 787 712");
  }
  if (candidate.paymentDeadline !== undefined) {
    dateString(candidate.paymentDeadline, "payload.paymentDeadline");
  }
  if (
    candidate.amountCents !== undefined &&
    candidate.amountCents !== 9500 &&
    candidate.amountCents !== 14500
  ) {
    invalid("payload.amountCents must be 9500 or 14500");
  }
  for (const key of ["note", "customerEmail", "customerPhone"] as const) {
    stringValue(candidate[key], `payload.${key}`, {
      max: key === "note" ? 5000 : 255,
    });
  }
  if (
    (candidate.template === "party_time_proposed" ||
      candidate.template === "party_payment_due") &&
    candidate.paymentDeadline === undefined
  ) {
    invalid("payload.paymentDeadline is required");
  }
  if (
    (candidate.template === "party_payment_due" ||
      candidate.template === "party_payment_recorded" ||
      candidate.template === "party_payment_expired") &&
    candidate.amountCents === undefined
  ) {
    invalid("payload.amountCents is required");
  }
  if (
    candidate.template === "staff_notification" &&
    (candidate.customerEmail === undefined ||
      candidate.customerPhone === undefined)
  ) {
    invalid("staff notification customer contact is required");
  }
  return candidate as CustomerManagePayload;
}

function uuidValue(value: unknown, field: string): string {
  const text = stringValue(value, field, { max: 36 });
  if (
    !text ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      text,
    )
  ) {
    invalid(`${field} must be a valid UUID`);
  }
  return text.toLowerCase();
}

function bookingInput(value: unknown): void {
  const candidate = record(
    value,
    "payload.input",
    [
      "name",
      "phone",
      "wechat",
      "email",
      "preferredDate",
      "numberOfPeople",
      "activityType",
      "interestedProject",
      "message",
      "locale",
      "timeSlotId",
    ],
    ["name", "phone"],
  );
  stringValue(candidate.name, "payload.input.name", { max: 255 });
  stringValue(candidate.phone, "payload.input.phone", { max: 64 });
  for (const key of [
    "wechat",
    "email",
    "preferredDate",
    "activityType",
    "interestedProject",
    "message",
    "locale",
    "timeSlotId",
  ]) {
    stringValue(candidate[key], `payload.input.${key}`, {
      max: key === "message" ? 5000 : 255,
      nullable: true,
    });
  }
  optionalInteger(candidate.numberOfPeople, "payload.input.numberOfPeople");
}

function cartInput(value: unknown): void {
  const candidate = record(
    value,
    "payload.input",
    [
      "name",
      "phone",
      "wechat",
      "email",
      "message",
      "timeSlotId",
      "numberOfPeople",
      "preferredDate",
      "locale",
      "items",
    ],
    ["name", "phone", "items"],
  );
  stringValue(candidate.name, "payload.input.name", { max: 255 });
  stringValue(candidate.phone, "payload.input.phone", { max: 64 });
  for (const key of [
    "wechat",
    "email",
    "message",
    "timeSlotId",
    "preferredDate",
    "locale",
  ]) {
    stringValue(candidate[key], `payload.input.${key}`, {
      max: key === "message" ? 5000 : 255,
      nullable: true,
    });
  }
  optionalInteger(candidate.numberOfPeople, "payload.input.numberOfPeople");
  if (
    !Array.isArray(candidate.items) ||
    candidate.items.length === 0 ||
    candidate.items.length > 50
  ) {
    invalid("payload.input.items must contain 1 to 50 items");
  }
  candidate.items.forEach((item, index) => {
    const entry = record(item, `payload.input.items[${index}]`, [
      "projectId",
      "styleId",
      "projectName",
      "projectType",
      "imageUrl",
      "styleName",
      "date",
      "people",
      "price",
      "priceCurrency",
    ]);
    stringValue(entry.projectId, `payload.input.items[${index}].projectId`, {
      max: 64,
      nullable: true,
    });
    stringValue(entry.styleId, `payload.input.items[${index}].styleId`, {
      max: 64,
      nullable: true,
    });
    localizedString(
      entry.projectName,
      `payload.input.items[${index}].projectName`,
    );
    if (
      entry.projectType != null &&
      entry.projectType !== "experience" &&
      entry.projectType !== "product"
    ) {
      invalid(`payload.input.items[${index}].projectType is invalid`);
    }
    localizedString(entry.styleName, `payload.input.items[${index}].styleName`);
    for (const key of ["imageUrl", "date", "price", "priceCurrency"]) {
      stringValue(entry[key], `payload.input.items[${index}].${key}`, {
        max: key === "imageUrl" ? 2048 : 128,
        nullable: true,
      });
    }
    optionalInteger(entry.people, `payload.input.items[${index}].people`);
  });
}

function validatePayloadForMessage(
  messageType: EmailMessageType,
  payload: unknown,
): EmailTemplatePayload {
  if (messageType === "admin_password_setup") {
    const candidate = record(
      payload,
      "payload",
      ["template", "name", "email", "role", "setupUrl", "expiresAt"],
      ["template", "name", "email", "role", "setupUrl", "expiresAt"],
    );
    if (candidate.template !== "admin_password_setup") {
      invalid("payload.template must be admin_password_setup");
    }
    stringValue(candidate.name, "payload.name", { max: 255 });
    const email = stringValue(candidate.email, "payload.email", { max: 255 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid("payload.email must be a valid email address");
    }
    if (!["owner", "admin", "staff"].includes(String(candidate.role))) {
      invalid("payload.role is invalid");
    }
    const setupUrl = stringValue(candidate.setupUrl, "payload.setupUrl", {
      max: 2048,
    });
    try {
      const parsed = new URL(setupUrl ?? "");
      const token = parsed.searchParams.get("token");
      if (
        parsed.origin !== "https://yezyy.com" ||
        parsed.pathname !== "/admin/setup-password" ||
        parsed.searchParams.size !== 1 ||
        !token ||
        !/^[A-Za-z0-9_-]{43}$/.test(token)
      ) {
        invalid("payload.setupUrl is invalid");
      }
    } catch {
      invalid("payload.setupUrl is invalid");
    }
    dateString(candidate.expiresAt, "payload.expiresAt");
    return candidate as AdminPasswordSetupOutboxPayload;
  }

  if (
    messageType === "booking_notification_customer" ||
    messageType === "booking_notification_owner"
  ) {
    const candidate = bookingNotification(payload);
    if (
      (messageType === "booking_notification_owner") !==
      (candidate.template === "staff_notification")
    ) {
      invalid("notification template does not match the recipient kind");
    }
    return candidate;
  }

  if (
    messageType === "booking_received_customer" ||
    messageType === "cart_order_received_customer"
  ) {
    const booking = messageType === "booking_received_customer";
    const allowed = booking
      ? [
          "template",
          "storeName",
          "orderId",
          "orderNumber",
          "submittedAt",
          "input",
          "contact",
        ]
      : ["template", "orderNumber", "submittedAt", "input", "contact"];
    const candidate = record(payload, "payload", allowed, allowed);
    const expectedTemplate = booking
      ? "booking_received"
      : "cart_order_received";
    if (candidate.template !== expectedTemplate) {
      invalid(`payload.template must be ${expectedTemplate}`);
    }
    if (booking) {
      if (
        candidate.storeName !==
        CANONICAL_BOOKING_EMAIL_IDENTITY.storeName
      ) {
        invalid(
          `payload.storeName must be ${CANONICAL_BOOKING_EMAIL_IDENTITY.storeName}`,
        );
      }
      stringValue(candidate.orderId, "payload.orderId", { max: 64 });
    }
    stringValue(candidate.orderNumber, "payload.orderNumber", { max: 128 });
    dateString(candidate.submittedAt, "payload.submittedAt");
    if (booking) bookingInput(candidate.input);
    else cartInput(candidate.input);
    if (booking) canonicalBookingContact(candidate.contact);
    else contact(candidate.contact);
    return candidate as EmailTemplatePayload;
  }

  if (
    messageType === "booking_received_owner" ||
    messageType === "cart_order_received_owner"
  ) {
    const candidate = record(
      payload,
      "payload",
      ["template", "subject", "heading", "fields"],
      ["template", "subject", "heading", "fields"],
    );
    if (candidate.template !== "owner_request") {
      invalid("payload.template must be owner_request");
    }
    stringValue(candidate.subject, "payload.subject", { max: 255 });
    stringValue(candidate.heading, "payload.heading", { max: 255 });
    if (!Array.isArray(candidate.fields) || candidate.fields.length > 50) {
      invalid("payload.fields must be an array with at most 50 items");
    }
    candidate.fields.forEach((field, index) => {
      const entry = record(
        field,
        `payload.fields[${index}]`,
        ["label", "value"],
        ["label", "value"],
      );
      stringValue(entry.label, `payload.fields[${index}].label`, { max: 128 });
      stringValue(entry.value, `payload.fields[${index}].value`, { max: 5000 });
    });
    return candidate as EmailTemplatePayload;
  }

  const candidate = record(
    payload,
    "payload",
    [
      "template",
      "status",
      "locale",
      "customerName",
      "orderNumber",
      "preferredDate",
      "slotLabel",
      "storeName",
      "address",
      "businessHours",
      "contact",
      "adminNote",
    ],
    [
      "template",
      "status",
      "customerName",
      "orderNumber",
      "storeName",
      "contact",
    ],
  );
  if (candidate.template !== "booking_status") {
    invalid("payload.template must be booking_status");
  }
  if (
    !["contacted", "pending_review", "confirmed", "waitlisted", "rejected", "reschedule_requested", "cancellation_requested", "cancelled", "no_show", "completed"].includes(String(candidate.status))
  ) {
    invalid("payload.status is invalid");
  }
  for (const key of ["customerName", "orderNumber", "storeName"]) {
    stringValue(candidate[key], `payload.${key}`, { max: 255 });
  }
  if (
    candidate.storeName !== CANONICAL_BOOKING_EMAIL_IDENTITY.storeName
  ) {
    invalid(
      `payload.storeName must be ${CANONICAL_BOOKING_EMAIL_IDENTITY.storeName}`,
    );
  }
  for (const key of [
    "locale",
    "preferredDate",
    "slotLabel",
    "address",
    "businessHours",
    "adminNote",
  ]) {
    stringValue(candidate[key], `payload.${key}`, {
      max: key === "adminNote" ? 5000 : 1000,
      nullable: true,
    });
  }
  canonicalBookingContact(candidate.contact);
  return candidate as EmailTemplatePayload;
}

const MESSAGE_TYPES = new Set<EmailMessageType>([
  "booking_received_customer",
  "booking_received_owner",
  "cart_order_received_customer",
  "cart_order_received_owner",
  "booking_status_customer",
  "cart_order_status_customer",
  "booking_notification_customer",
  "booking_notification_owner",
  "admin_password_setup",
]);

export function validateEmailOutboxEnvelope(
  input: EmailOutboxEnvelope,
): ValidatedEmailOutboxEnvelope {
  if (!MESSAGE_TYPES.has(input.messageType as EmailMessageType)) {
    invalid("messageType is unsupported");
  }
  const messageType = input.messageType as EmailMessageType;
  const bookingId =
    input.bookingId == null ? null : uuidValue(input.bookingId, "bookingId");
  const cartOrderId =
    input.cartOrderId == null
      ? null
      : uuidValue(input.cartOrderId, "cartOrderId");
  const isAdminPasswordSetup = messageType === "admin_password_setup";
  if (
    (isAdminPasswordSetup && (bookingId !== null || cartOrderId !== null)) ||
    (!isAdminPasswordSetup && Boolean(bookingId) === Boolean(cartOrderId))
  ) {
    invalid("exactly one request parent is required");
  }
  const expectsBooking = messageType.startsWith("booking_");
  if (
    !isAdminPasswordSetup &&
    ((expectsBooking && !bookingId) || (!expectsBooking && !cartOrderId))
  ) {
    invalid("messageType does not match the request parent");
  }
  const isStatus = messageType.endsWith("_status_customer");
  const isLifecycleNotification =
    messageType === "booking_notification_customer" ||
    messageType === "booking_notification_owner";
  const statusEventId =
    input.statusEventId == null
      ? null
      : uuidValue(input.statusEventId, "statusEventId");
  const recipient = stringValue(input.recipient, "recipient", { max: 255 });
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    invalid("recipient must be a valid email address");
  }
  const locale = stringValue(input.locale, "locale", { max: 16 });
  if (!locale || !/^(?:en|zh)(?:-[a-z]{2,8})?$/i.test(locale)) {
    invalid("locale is unsupported");
  }
  const payload = validatePayloadForMessage(messageType, input.payload);
  if (
    isAdminPasswordSetup &&
    (payload as AdminPasswordSetupOutboxPayload).email !== recipient
  ) {
    invalid("payload.email must match recipient");
  }
  const requiresStatusEvent =
    isStatus || isStatusLifecycleTemplate(payload.template);
  if (
    (requiresStatusEvent && !statusEventId) ||
    (!isStatus &&
      !isLifecycleNotification &&
      statusEventId)
  ) {
    invalid(
      requiresStatusEvent
        ? "statusEventId is required for status lifecycle messages"
        : "statusEventId is not allowed for receipt messages",
    );
  }
  if (
    payload.template === "booking_received" &&
    payload.orderId !== bookingId
  ) {
    invalid("payload.orderId does not match bookingId");
  }
  const payloadLocale =
    payload.template === "booking_received"
      ? payload.input.locale
      : payload.template === "booking_status"
        ? payload.locale
        : undefined;
  if (
    typeof payloadLocale === "string" &&
    payloadLocale.toLowerCase() !== locale.toLowerCase()
  ) {
    invalid("payload locale does not match envelope locale");
  }
  return {
    bookingId,
    cartOrderId,
    statusEventId,
    messageType,
    recipient,
    locale: locale.toLowerCase(),
    payload,
  };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

export function canonicalEmailPayload(payload: EmailTemplatePayload): string {
  return JSON.stringify(canonicalValue(payload));
}
