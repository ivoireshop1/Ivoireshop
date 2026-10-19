"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/src/types/catalog";
import { useCart } from "@/src/lib/cart/cart-context";
import { remainingPurchasableQuantity } from "@/src/lib/catalog/inventory";
import { formatSellQuantity, sellingSettingsFromProduct, snapQuantity } from "@/src/lib/catalog/selling";
import { QuantitySelector } from "./quantity-selector";
import { WeightSelector } from "./weight-selector";

export function AddToCart({ product }: { product: Product }) {
  const { addItem, items } = useCart();
  const settings = sellingSettingsFromProduct({
    selling_method: product.sellingMethod,
    selling_unit: product.sellingUnit,
    unit_increment: product.unitIncrement,
    min_sell_qty: product.minSellQty,
    max_sell_qty: product.maxSellQty,
    package_weight_lb: product.packageWeightLb,
  });
  const [quantity, setQuantity] = useState(() => settings.minSellQty);
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const cartItem = items.find((item) => item.productId === product.id);
  const remaining = remainingPurchasableQuantity(product.trackInventory, product.stockQuantity, cartItem?.quantity ?? 0);
  const unavailable = product.isComingSoon || remaining === 0 || product.price <= 0;
  const weightBased = settings.sellingMethod === "weight";
  const safeQty = snapQuantity(quantity, { ...settings, maxSellQty: settings.maxSellQty != null ? Math.min(settings.maxSellQty, remaining) : remaining || settings.maxSellQty });

  if (product.isComingSoon) {
    return <p className="rounded-xl border border-forest-green/15 bg-[#f5f0e6] px-4 py-3 text-sm text-muted">This product is coming soon and cannot be added to your cart.</p>;
  }

  function add() {
    if (isAdding || unavailable || safeQty > remaining) return;
    setIsAdding(true);
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: safeQty,
      sellingMethod: settings.sellingMethod,
      sellingUnit: settings.sellingUnit,
      unitIncrement: settings.unitIncrement,
      minSellQty: settings.minSellQty,
      maxSellQty: settings.maxSellQty,
    });

    window.setTimeout(() => {
      setIsAdding(false);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    }, 150);
  }

  const cartQuantity = cartItem?.quantity ?? 0;
  const unitPriceLabel = weightBased
    ? `$${product.price.toFixed(2)} / ${settings.sellingUnit}`
    : `$${product.price.toFixed(2)} each`;

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm font-medium text-muted">{unitPriceLabel}</p>

      {weightBased ? (
        <WeightSelector
          max={remaining}
          onChange={setQuantity}
          settings={settings}
          unitPrice={product.price}
          value={quantity}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <QuantitySelector value={quantity} onChange={setQuantity} max={remaining} />
        </div>
      )}

      {unavailable && (
        <p role="status" className="text-sm text-muted">
          {product.trackInventory !== false && product.stockQuantity === 0
            ? "Out of stock"
            : remaining === 0 && cartItem
              ? "All available units are in your cart"
              : "Currently unavailable"}
        </p>
      )}

      {cartItem ? (
        <div className="flex items-center gap-2 rounded-lg border border-forest-green/20 bg-[#f5f0e6] px-4 py-3 text-sm font-semibold text-forest-green">
          <span aria-hidden="true">✓</span>
          <span>
            {weightBased
              ? `${formatSellQuantity(cartQuantity, settings.sellingUnit)} already in cart`
              : `${cartQuantity} already in cart`}
          </span>
        </div>
      ) : null}

      <button
        aria-label={isAdding ? `Adding ${product.name} to cart` : `Add ${product.name} to cart`}
        className="w-full rounded-lg bg-forest-green px-7 py-3 font-semibold text-white transition hover:bg-forest-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        disabled={isAdding || unavailable || safeQty > remaining}
        onClick={add}
        type="button"
      >
        {isAdding ? "Adding…" : added ? "✓ Added to cart" : "Add to cart"}
      </button>

      {cartItem && (
        <div className="w-full rounded-xl bg-[#f5f0e6] p-4 text-sm">
          <p className="font-semibold text-forest-green">
            Already in cart:{" "}
            {weightBased ? formatSellQuantity(cartItem.quantity, settings.sellingUnit) : cartItem.quantity}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 font-semibold">
            <Link className="text-forest-green underline underline-offset-4" href="/cart">
              View cart
            </Link>
            <button className="text-forest-green underline underline-offset-4 disabled:opacity-50" disabled={isAdding || unavailable || safeQty > remaining} onClick={add} type="button">
              Add more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
