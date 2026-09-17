import Link from "next/link";

export function CartSummary({ subtotal, items }: { subtotal: number; items: Array<{ price: number; compareAtPrice?: number; quantity: number }> }) {
  const delivery = subtotal >= 50 ? 0 : 7.5;
  const total = subtotal + delivery;
  const savings = items.reduce((sum, item) => {
    const listPrice = item.compareAtPrice ?? item.price;
    return sum + Math.max(0, listPrice - item.price) * item.quantity;
  }, 0);

  return (
    <aside className="rounded-[28px] border border-black/8 bg-[#f5f0e6] p-6 shadow-[0_18px_32px_rgba(23,63,53,0.06)]">
      <h2 className="text-xl font-semibold text-forest-green">Order summary</h2>

      <div className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Subtotal</span>
          <strong className="text-forest-green">${subtotal.toFixed(2)}</strong>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Delivery</span>
          <span>{delivery === 0 ? "Free" : `$${delivery.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Tax</span>
          <span>Calculated at checkout</span>
        </div>
      </div>

      <div className="mt-6 border-t border-black/10 pt-4">
        <div className="flex justify-between text-base font-semibold text-forest-green">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {savings > 0 ? (
        <p className="mt-5 rounded-xl border border-forest-green/10 bg-white/60 px-3 py-2 text-xs leading-5 text-muted">
          You saved ${savings.toFixed(2)} shopping with us today.
        </p>
      ) : (
        <p className="mt-5 rounded-xl border border-forest-green/10 bg-white/60 px-3 py-2 text-xs leading-5 text-muted">
          Free delivery over $50. Secure checkout and fresh fulfillment for every order.
        </p>
      )}

      <Link className="mt-5 flex justify-center rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-green/90" href="/checkout">
        Proceed to checkout
      </Link>
    </aside>
  );
}
