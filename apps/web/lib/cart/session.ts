import { getApiBaseUrl } from "@/lib/api/config";
import type { CartItem } from "./types";

type ApiSuccess<T> = { success: true; data: T };

export async function loadCartFromServer(): Promise<CartItem[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/cart`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as ApiSuccess<{ items: CartItem[] }>;
    if (!json.success) return [];
    return json.data.items ?? [];
  } catch {
    return [];
  }
}

export async function saveCartToServer(items: CartItem[]): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/v1/cart`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch {
    /* offline — local cart still works */
  }
}
