"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { addToWishlist, getWishlist, removeFromWishlist } from "./wishlist-service";
import type { WishlistItem } from "@/src/types/wishlist";

type WishlistContextValue = {
  items: WishlistItem[];
  isLoading: boolean;
  error: string | null;
  addItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleItem: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  refreshWishlist: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<WishlistItem[]>([]);

  const refreshWishlist = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await createClient().auth.getUser();
      setItems(user ? await getWishlist() : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load wishlist.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshWishlist(); }, 0);
    const { data: listener } = createClient().auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") return;
      void refreshWishlist({ silent: event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "INITIAL_SESSION" });
    });
    return () => {
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [refreshWishlist]);

  const update = useCallback(async (productId: string, action: "add" | "remove") => {
    const previous = itemsRef.current;
    const existing = previous.find((item) => item.productId === productId);
    if (action === "add" && existing) return;
    setItems(action === "add" ? [...previous, { id: `pending-${productId}`, productId }] : previous.filter((item) => item.productId !== productId));
    setError(null);
    try {
      if (action === "add") await addToWishlist(productId);
      else await removeFromWishlist(productId);
      await refreshWishlist({ silent: true });
    } catch (reason) {
      setItems(previous);
      setError(reason instanceof Error ? reason.message : "Unable to update wishlist.");
      throw reason;
    }
  }, [refreshWishlist]);

  const value = useMemo(() => ({
    items, isLoading, error,
    addItem: (productId: string) => update(productId, "add"),
    removeItem: (productId: string) => update(productId, "remove"),
    toggleItem: (productId: string) => update(productId, items.some((item) => item.productId === productId) ? "remove" : "add"),
    isWishlisted: (productId: string) => items.some((item) => item.productId === productId),
    refreshWishlist: () => refreshWishlist({ silent: true }),
  }), [items, isLoading, error, refreshWishlist, update]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
}
