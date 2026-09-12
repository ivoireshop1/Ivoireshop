import Link from "next/link";

export function CartEmptyState() { return <div className="rounded-2xl bg-[#f5f0e6] px-6 py-16 text-center"><h1 className="text-3xl font-semibold text-forest-green">Your cart is empty</h1><p className="mt-3 text-muted">Discover something delicious for your everyday table.</p><Link className="mt-7 inline-flex rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/shop">Continue Shopping</Link></div>; }
