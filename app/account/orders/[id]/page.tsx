import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/server";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { ReorderButton } from "@/src/components/customer/reorder-button";
import { fulfillmentLabel } from "@/src/lib/fulfillment/fulfillment";

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/account/orders/${id}`);

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("id, order_number, status, total, fulfillment_method, created_at, shipping_address").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("product_name, product_price, quantity").eq("order_id", id),
  ]);

  if (!order) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <SmartBackButton fallbackHref="/account" fallbackLabel="Back to account" />
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Order</p>
      <h1 className="mt-2 text-4xl font-semibold text-forest-green">{order.order_number}</h1>
      <p className="mt-3 text-muted">
        {new Date(order.created_at).toLocaleDateString()} · {order.status.replaceAll("_", " ")} · {fulfillmentLabel(order.fulfillment_method)}
      </p>

      <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-forest-green">Items</h2>
        <div className="mt-4 space-y-3">
          {(items ?? []).map((item, index) => (
            <div className="flex justify-between gap-4 text-sm" key={`${item.product_name}-${index}`}>
              <span className="text-muted">{item.product_name} × {item.quantity}</span>
              <span className="font-semibold text-forest-green">${(Number(item.product_price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <p className="mt-5 text-right text-lg font-semibold text-forest-green">Total ${Number(order.total).toFixed(2)}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ReorderButton orderId={order.id} />
          <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/shop">
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
