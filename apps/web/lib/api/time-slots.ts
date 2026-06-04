import { getApiBaseUrl } from "./config";

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };

export type MonthAvailability = {
  dates: Array<{ date: string; status: "none" | "available" | "full" }>;
};

export type TimeSlotOption = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  remaining: number;
  almostFull: boolean;
};

export type DaySlots = {
  slots: TimeSlotOption[];
};

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`);
  const json = (await res.json()) as ApiSuccess<T> | ApiError;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

export function fetchMonthAvailability(year: number, month: number, categoryId?: string) {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (categoryId) params.set("categoryId", categoryId);
  return fetchApi<MonthAvailability>(`/api/v1/time-slots?${params}`);
}

export function fetchDaySlots(date: string, categoryId?: string) {
  const params = new URLSearchParams({ date });
  if (categoryId) params.set("categoryId", categoryId);
  return fetchApi<DaySlots>(`/api/v1/time-slots?${params}`);
}
