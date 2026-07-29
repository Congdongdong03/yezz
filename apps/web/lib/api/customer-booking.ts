import { ApiClientError, parseResponse } from "./base";
import { getSiteUrl } from "@/lib/site/url";

export type CustomerBookingAction =
  | "accept_time"
  | "request_cancellation"
  | "request_reschedule";

export type CustomerBookingView = {
  kind: "experience" | "party";
  status: string;
  locale: "en" | "zh";
  offeringLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  allowedActions: CustomerBookingAction[];
  proposedTime?: {
    date: string;
    startTime: string;
    endTime: string;
  };
};

type CustomerActionResult = { status: string };

const ALLOWED_ACTIONS = new Set<CustomerBookingAction>([
  "accept_time",
  "request_cancellation",
  "request_reschedule",
]);

function customerPath(token: string, action?: string): string {
  const base = `/api/backend/v1/customer-bookings/${encodeURIComponent(token)}`;
  return action ? `${base}/${action}` : base;
}

function customerBookingBffOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return process.env.NODE_ENV === "production"
    ? getSiteUrl()
    : "http://localhost:3000";
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

function parseCustomerBookingView(value: unknown): CustomerBookingView {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiClientError("Invalid customer booking response", "PARSE_ERROR");
  }
  const input = value as Record<string, unknown>;
  if (
    (input.kind !== "experience" && input.kind !== "party") ||
    typeof input.status !== "string" ||
    (input.locale !== "en" && input.locale !== "zh") ||
    typeof input.offeringLabel !== "string" ||
    !isDate(input.date) ||
    !isTime(input.startTime) ||
    !isTime(input.endTime) ||
    !Array.isArray(input.allowedActions)
  ) {
    throw new ApiClientError("Invalid customer booking response", "PARSE_ERROR");
  }
  const allowedActions = input.allowedActions.filter(
    (action): action is CustomerBookingAction =>
      typeof action === "string" &&
      ALLOWED_ACTIONS.has(action as CustomerBookingAction),
  );
  let proposedTime: CustomerBookingView["proposedTime"];
  if (
    input.proposedTime &&
    typeof input.proposedTime === "object" &&
    !Array.isArray(input.proposedTime)
  ) {
    const proposed = input.proposedTime as Record<string, unknown>;
    if (
      isDate(proposed.date) &&
      isTime(proposed.startTime) &&
      isTime(proposed.endTime)
    ) {
      proposedTime = {
        date: proposed.date,
        startTime: proposed.startTime,
        endTime: proposed.endTime,
      };
    }
  }
  return {
    kind: input.kind,
    status: input.status,
    locale: input.locale,
    offeringLabel: input.offeringLabel,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    allowedActions,
    ...(proposedTime ? { proposedTime } : {}),
  };
}

export async function getCustomerBooking(
  token: string,
  trustedClientIp?: string | null,
): Promise<CustomerBookingView> {
  const response = await fetch(
    `${customerBookingBffOrigin()}${customerPath(token)}`,
    {
      cache: "no-store",
      ...(trustedClientIp
        ? { headers: { "x-vercel-forwarded-for": trustedClientIp } }
        : {}),
    },
  );
  return parseCustomerBookingView(
    await parseResponse<CustomerBookingView>(response),
  );
}

async function postCustomerAction(
  token: string,
  action: string,
  body?: Record<string, string>,
): Promise<CustomerActionResult> {
  const response = await fetch(customerPath(token, action), {
    method: "POST",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  return parseResponse<CustomerActionResult>(response);
}

export function acceptProposedTime(token: string) {
  return postCustomerAction(token, "accept-time");
}

export function requestCustomerCancellation(token: string) {
  return postCustomerAction(token, "request-cancellation");
}

export function requestCustomerReschedule(
  token: string,
  request: { date: string; startTime: string },
) {
  return postCustomerAction(token, "request-reschedule", request);
}
