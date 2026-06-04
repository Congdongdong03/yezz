import { getApiBaseUrl } from "@/lib/api/config";
import type { CartItem } from "./types";

const COOKIE_NAME = "yezz_cart_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

type ApiSuccess<T> = { success: true; data: T };

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(id: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function getOrCreateCartSessionId(): string {
  const existing = readCookie();
  if (existing) return existing;
  const id = crypto.randomUUID();
  writeCookie(id);
  return id;
}

export async function loadCartFromServer(): Promise<CartItem[]> {
  const sessionId = getOrCreateCartSessionId();
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/cart/${sessionId}`);
    const json = (await res.json()) as ApiSuccess<{ items: CartItem[] }>;
    if (!json.success) return [];
    return json.data.items ?? [];
  } catch {
    return [];
  }
}

export async function saveCartToServer(items: CartItem[]): Promise<void> {
  const sessionId = getOrCreateCartSessionId();
  try {
    await fetch(`${getApiBaseUrl()}/api/v1/cart/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch {
    /* offline — local cart still works */
  }
}
