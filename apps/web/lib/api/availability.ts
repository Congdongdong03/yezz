import { ApiClientError } from "./base";
import { getApiBaseUrl } from "./config";

type ApiSuccess<T> = { success: true; data: T };
type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type OrdinaryAvailabilityQuery = {
  date: string;
  durationMinutes: 30 | 60;
  attendance: number;
};

export type OrdinaryAvailabilitySlot = {
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "waitlist";
  remaining: number;
};

export async function getOrdinaryAvailability(
  query: OrdinaryAvailabilityQuery,
): Promise<OrdinaryAvailabilitySlot[]> {
  const params = new URLSearchParams({
    date: query.date,
    durationMinutes: String(query.durationMinutes),
    attendance: String(query.attendance),
  });
  let response: Response;
  try {
    response = await fetch(
      `${getApiBaseUrl()}/api/v1/availability/ordinary?${params}`,
      { cache: "no-store" },
    );
  } catch (cause) {
    throw new ApiClientError(
      cause instanceof Error ? cause.message : "Could not reach availability",
      "NETWORK_ERROR",
    );
  }

  let body: ApiSuccess<OrdinaryAvailabilitySlot[]> | ApiError;
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new ApiClientError(
      "Invalid availability response",
      "PARSE_ERROR",
      response.status,
    );
  }
  if (!body.success) {
    throw new ApiClientError(
      body.error.message,
      body.error.code,
      response.status,
      body.error.details,
    );
  }
  return body.data;
}
