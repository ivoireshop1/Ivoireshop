"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/src/types/cart";
import { loadCart, saveCart } from "./cart-storage";
import { itemCount, mergeItem, subtotal } from "./cart-utils";

type CartInput = CartItem | (Omit<CartItem, "quantity" | "slug" | "image"> & Partial<Pick<CartItem, "quantity" | "slug" | "image">>);
type CartContextValue = {
  items: CartItem[];
  isLoaded: boolean;
  lastAddedItem: CartItem | null;
  addEventId: number;
  totalItems: number;
  itemCount: number;
  subtotal: number;
  addItem: (item: CartInput, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);
  const [addEventId, setAddEventId] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => { setItems(loadCart()); setIsLoaded(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (isLoaded) saveCart(items); }, [items, isLoaded]);
  const value = useMemo(() => ({
    items,
    isLoaded,
    lastAddedItem,
    addEventId,
    totalItems: itemCount(items),
    itemCount: itemCount(items),
    subtotal: subtotal(items),
    addItem: (item: CartInput, quantity = 1) => {
      const complete: CartItem = { productId: item.productId, slug: item.slug ?? "", name: item.name, price: item.price, image: item.image ?? "", quantity: "quantity" in item && item.quantity ? item.quantity : quantity };
      setItems((current) => mergeItem(current, complete));
      setLastAddedItem(complete);
      setAddEventId((eventId) => eventId + 1);
    },
    removeItem: (productId: string) => setItems((current) => current.filter((item) => item.productId !== productId)),
    updateQuantity: (productId: string, quantity: number) => setItems((current) => quantity <= 0 || !Number.isFinite(quantity) ? current.filter((item) => item.productId !== productId) : current.map((item) => item.productId === productId ? { ...item, quantity: Math.max(1, Math.floor(quantity)) } : item)),
    incrementQuantity: (productId: string) => setItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)),
    decrementQuantity: (productId: string) => setItems((current) => current.flatMap((item) => item.productId !== productId ? [item] : item.quantity <= 1 ? [] : [{ ...item, quantity: item.quantity - 1 }])),
    clearCart: () => setItems([]),
  }), [items, isLoaded, lastAddedItem, addEventId]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
