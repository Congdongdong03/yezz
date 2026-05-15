"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CartItem } from "./types";
import { getCart, setCart } from "./storage";

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

  useEffect(() => {
    setItems(getCart());
  }, []);

  useEffect(() => {
    setCart(items);
  }, [items]);

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
    setItems([]);
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
