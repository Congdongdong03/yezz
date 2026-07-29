import { createHash, createHmac } from "node:crypto";
import type { CustomerActionScope, Db, LocalizedString } from "@yezz/db";
import { AppError } from "./errors.js";
import {
  CANONICAL_BOOKING_EMAIL_IDENTITY,
  type CustomerManagePayload,
} from "./email-outbox-payload.js";
import { formatBookingOrderId } from "./email.js";
import { createCustomerActionTokensRepository } from "../repositories/customer-action-tokens.repository.js";

export function bookingLocale(value: string | null): "en" | "zh" {
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function bookingOfferingLabel(
  value: LocalizedString | null,
  locale: "en" | "zh",
  kind: string,
): string {
  return (
    value?.[locale] ??
    value?.en ??
    value?.zh ??
    (kind === "party" ? "Party booking" : "DIY booking")
  );
}

function baseUrl(configured?: string): URL {
  const parsed = new URL(
    configured ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AppError(
      503,
      "CUSTOMER_MANAGE_URL_UNAVAILABLE",
      "Booking management links are temporarily unavailable",
    );
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

export function customerManageUrl(
  locale: "en" | "zh",
  rawToken: string,
  configuredBaseUrl?: string,
): string {
  const target = baseUrl(configuredBaseUrl);
  const prefix = target.pathname.replace(/\/$/, "");
  target.pathname = `${prefix}/${locale}/manage-booking/${rawToken}`;
  return target.toString();
}

export function staffBookingUrl(
  bookingId: string,
  configuredBaseUrl?: string,
): string {
  const target = baseUrl(configuredBaseUrl);
  const prefix = target.pathname.replace(/\/$/, "");
  target.pathname = `${prefix}/admin/bookings/${bookingId}`;
  return target.toString();
}

function actionSecret(configured?: string): string {
  const secret = configured ?? process.env.CUSTOMER_ACTION_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new AppError(
      503,
      "CUSTOMER_ACTION_TOKEN_SECRET_UNAVAILABLE",
      "Customer action tokens are temporarily unavailable",
    );
  }
  return secret;
}

export async function issueDeterministicManagementToken(
  input: {
    bookingId: string;
    identity: string;
    now: Date;
    scopes?: CustomerActionScope[];
    secret?: string;
  },
  tx: Db,
): Promise<string> {
  const raw = createHmac("sha256", actionSecret(input.secret))
    .update(`booking-manage:${input.bookingId}:${input.identity}`)
    .digest("base64url");
  await createCustomerActionTokensRepository(tx).create(
    {
      bookingId: input.bookingId,
      tokenDigest: createHash("sha256").update(raw).digest("hex"),
      scopes: input.scopes ?? [
        "request_cancellation",
        "request_reschedule",
      ],
      expiresAt: new Date(input.now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
    tx,
  );
  return raw;
}

export function notificationPayload(input: {
  template: CustomerManagePayload["template"];
  booking: {
    id: string;
    createdAt: Date;
    name: string;
    requestKind: string;
    offeringNameSnapshot: LocalizedString | null;
  };
  locale: "en" | "zh";
  date: string;
  startTime: string;
  endTime: string;
  manageUrl: string;
  paymentDeadline?: string;
  amountCents?: 9500 | 14500;
  note?: string;
  customerEmail?: string;
  customerPhone?: string;
}): CustomerManagePayload {
  return {
    template: input.template,
    customerName: input.booking.name,
    bookingNumber: formatBookingOrderId(
      input.booking.id,
      input.booking.createdAt,
    ),
    offeringLabel: bookingOfferingLabel(
      input.booking.offeringNameSnapshot,
      input.locale,
      input.booking.requestKind,
    ),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    manageUrl: input.manageUrl,
    ...CANONICAL_BOOKING_EMAIL_IDENTITY,
    ...(input.paymentDeadline
      ? { paymentDeadline: input.paymentDeadline }
      : {}),
    ...(input.amountCents ? { amountCents: input.amountCents } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
    ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
  };
}
