"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { useWishlist } from "@/src/lib/wishlist/wishlist-context";

export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const { isWishlisted, toggleItem } = useWishlist();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const saved = isWishlisted(productId);
  async function toggle() {
    if (isSaving) return;
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) {
      const current = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?returnTo=${encodeURIComponent(current)}`);
      return;
    }
    setIsSaving(true);
    try { await toggleItem(productId); } finally { setIsSaving(false); }
  }
  return <button aria-label={saved ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`} aria-pressed={saved} className="rounded-full px-2 py-1 text-lg text-forest-green hover:bg-forest-green/10 disabled:opacity-50" disabled={isSaving} onClick={() => void toggle()} type="button">{saved ? "♥" : "♡"}</button>;
}
