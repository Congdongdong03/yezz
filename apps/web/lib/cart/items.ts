import type { CartItem } from "./types";

export function insertCartItem(items: CartItem[], item: CartItem) {
  if (items.some((current) => current.projectId === item.projectId)) {
    return { items, added: false };
  }

  return { items: [...items, item], added: true };
}
