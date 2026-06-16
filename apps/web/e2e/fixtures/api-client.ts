/**
 * API Client helpers for E2E tests.
 * Used to seed test data and clean up via direct API calls.
 */

import { readFileSync } from "node:fs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const AUTH_STATE_PATH = "e2e/.auth/admin.json";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: { code: string; message: string } };

async function parseResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiSuccess<T> | ApiError;
  if (!json.success) {
    throw new Error(
      `API error: ${json.error?.code ?? "UNKNOWN"} - ${json.error?.message ?? "Unknown error"}`,
    );
  }
  return json.data as T;
}

export async function apiPost<T>(path: string, body: unknown, cookie?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown, cookie?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiGet<T>(path: string, cookie?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(path: string, cookie?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers });
  return parseResponse<T>(res);
}

/** Admin login and return the Set-Cookie header value */
export async function adminLogin(
  email = "admin@yezz.local",
  password = "changeme",
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const json = (await res.json()) as ApiSuccess<unknown> | ApiError;
  if (!json.success) {
    throw new Error(`Login failed: ${json.error?.message ?? "Unknown"}`);
  }

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Login succeeded but no cookie returned");
  }

  // Extract the token cookie value
  const match = setCookie.match(/token=([^;]+)/);
  if (!match) {
    throw new Error("No token cookie found in response");
  }

  return `token=${match[1]}`;
}

/** Read admin cookie from Playwright's saved auth state (avoids repeated logins). */
export function getAdminCookieFromState(path = AUTH_STATE_PATH): string | null {
  try {
    const state = JSON.parse(readFileSync(path, "utf-8")) as {
      cookies: Array<{ name: string; value: string }>;
    };
    const token = state.cookies.find((c) => c.name === "token");
    return token ? `token=${token.value}` : null;
  } catch {
    return null;
  }
}

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  isAvailable: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: { en: string; zh: string };
}

export interface Project {
  id: string;
  slug: string;
  name: { en: string; zh: string };
  projectType: "experience" | "product";
}

export async function fetchCategories(): Promise<Category[]> {
  return apiGet<Category[]>("/api/v1/categories");
}

export async function fetchProjects(): Promise<Project[]> {
  return apiGet<Project[]>("/api/v1/projects");
}

export async function createTimeSlot(
  cookie: string,
  data: {
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    categoryId?: string;
  },
): Promise<TimeSlot> {
  return apiPost<TimeSlot>("/api/v1/admin/time-slots", data, cookie);
}

export async function deleteTimeSlot(cookie: string, id: string): Promise<void> {
  await apiDelete(`/api/v1/admin/time-slots/${id}`, cookie);
}

export async function getAdminBookings(cookie: string): Promise<{
  data: Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
    createdAt: string;
  }>;
  total: number;
}> {
  return apiGet("/api/v1/admin/bookings", cookie);
}

export async function updateBookingStatus(
  cookie: string,
  id: string,
  status: string,
  note?: string,
): Promise<unknown> {
  return apiPatch(`/api/v1/admin/bookings/${id}`, { status, note }, cookie);
}

export async function getAdminOrders(cookie: string): Promise<
  Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
    createdAt: string;
  }>
> {
  return apiGet("/api/v1/admin/orders", cookie);
}
