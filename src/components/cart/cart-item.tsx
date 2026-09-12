"use client";

import Image from "next/image";
import Link from "next/link";
import type { CartItem as CartItemType } from "@/src/types/cart";
import { useCart } from "@/src/lib/cart/cart-context";

export function CartItem({ item }: { item: CartItemType }) {
  const { incrementQuantity, decrementQuantity, removeItem } = useCart();
  return <article className="flex gap-4 border-b border-black/10 py-5"><Link className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#eadfce]" href={`/product/${item.slug}`}><Image alt={item.name} className="object-cover" fill sizes="96px" src={item.image} /></Link><div className="min-w-0 flex-1"><Link className="font-semibold text-forest-green hover:underline" href={`/product/${item.slug}`}>{item.name}</Link><p className="mt-1 text-sm text-muted">${item.price.toFixed(2)}</p><div className="mt-3 flex flex-wrap items-center gap-3"><div className="inline-flex items-center rounded-lg border border-black/15"><button aria-label={`Decrease quantity for ${item.name}`} className="px-3 py-2 text-lg" onClick={() => decrementQuantity(item.productId)} type="button">−</button><span className="min-w-9 text-center text-sm">{item.quantity}</span><button aria-label={`Increase quantity for ${item.name}`} className="px-3 py-2 text-lg" onClick={() => incrementQuantity(item.productId)} type="button">+</button></div><button aria-label={`Remove ${item.name} from cart`} className="text-sm text-muted underline underline-offset-4" onClick={() => removeItem(item.productId)} type="button">Remove</button></div></div><p className="font-semibold text-forest-green">${(item.price * item.quantity).toFixed(2)}</p></article>;
}
