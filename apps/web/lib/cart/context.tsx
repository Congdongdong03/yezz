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

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (projectId: string) => void;
  clearItems: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const skipNextSync = useRef(false);

  useEffect(() => {
    (async () => {
      const local = getCart();
      const remote = await loadCartFromServer();
      if (remote.length > 0) {
        setItems(remote);
        setCart(remote);
      } else {
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

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.projectId === item.projectId);
      if (exists) return prev;
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((projectId: string) => {
    setItems((prev) => prev.filter((i) => i.projectId !== projectId));
  }, []);

  const clearItems = useCallback(() => {
    skipNextSync.current = true;
    setItems([]);
    void saveCartToServer([]);
  }, []);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearItems, isOpen, setIsOpen, toggle }}
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
