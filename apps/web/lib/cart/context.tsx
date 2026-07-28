"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { CartItem } from "./types";
import { getCart, setCart } from "./storage";
import { loadCartFromServer, saveCartToServer } from "./session";
import { insertCartItem } from "./items";

export type CartNotice = "duplicate" | null;

interface CartContextValue {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: CartItem) => boolean;
  removeItem: (projectId: string) => void;
  clearItems: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  notice: CartNotice;
  clearNotice: () => void;
  highlightCart: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<CartNotice>(null);
  const [highlightCart, setHighlightCart] = useState(false);
  const itemsRef = useRef<CartItem[]>([]);
  const skipNextSync = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((type: CartNotice) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(type);
    if (type === "duplicate") {
      setHighlightCart(true);
    }
    noticeTimer.current = setTimeout(() => {
      setNotice(null);
      setHighlightCart(false);
    }, 2500);
  }, []);

  const clearNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(null);
    setHighlightCart(false);
  }, []);

  useEffect(() => {
    (async () => {
      const local = getCart();
      const remote = await loadCartFromServer();
      if (remote.length > 0) {
        itemsRef.current = remote;
        setItems(remote);
        setCart(remote);
      } else {
        itemsRef.current = local;
        setItems(local);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setCart(items);
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    void saveCartToServer(items);
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: CartItem) => {
      const result = insertCartItem(itemsRef.current, item);
      if (!result.added) {
        showNotice("duplicate");
        return false;
      }

      itemsRef.current = result.items;
      setItems(result.items);
      return true;
    },
    [showNotice],
  );

  const removeItem = useCallback((projectId: string) => {
    setItems((previousItems) => {
      const nextItems = previousItems.filter((item) => item.projectId !== projectId);
      itemsRef.current = nextItems;
      return nextItems;
    });
  }, []);

  const clearItems = useCallback(() => {
    skipNextSync.current = true;
    itemsRef.current = [];
    setItems([]);
    void saveCartToServer([]);
  }, []);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  return (
    <CartContext.Provider
      value={{
        items,
        hydrated,
        addItem,
        removeItem,
        clearItems,
        isOpen,
        setIsOpen,
        toggle,
        notice,
        clearNotice,
        highlightCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
