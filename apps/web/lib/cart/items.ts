import type { CartItem } from "./types";

export function insertCartItem(items: CartItem[], item: CartItem) {
  if (items.some((current) => current.projectId === item.projectId)) {
    return { items, added: false };
  }

  return { items: [...items, item], added: true };
}

export function mergeCartAfterHydration({
  localItems,
  remoteItems,
  pendingItems,
}: {
  localItems: CartItem[];
  remoteItems: CartItem[];
  pendingItems: CartItem[];
}): CartItem[] {
  const loadedItems = remoteItems.length > 0 ? remoteItems : localItems;

  return pendingItems.reduce(
    (items, item) => insertCartItem(items, item).items,
    loadedItems,
  );
}
