import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminFulfillmentPage() {
  const { supabase } = await requireAdmin();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, status, payment_status, fulfillment_method, total, created_at, shipping_address")
    .in("status", ["confirmed", "processing", "ready_for_pickup", "shipped"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load fulfillment queue.");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Fulfillment</h1>
      </div>

      {!orders?.length ? (
        <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center text-[#6b6b6b]">
          There are no active fulfillment jobs right now.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const shippingAddress = (order.shipping_address as { city?: string; country?: string } | null) ?? null;
            const deliveryLocation = shippingAddress ? [shippingAddress.city, shippingAddress.country].filter(Boolean).join(", ") : "Pickup / delivery details pending";

            return (
              <Link
                className="grid gap-2 rounded-2xl border border-[#173f35]/10 bg-white p-4 md:grid-cols-[1.2fr_1fr_1fr_0.9fr_0.8fr]"
                href={`/admin/orders/${order.id}`}
                key={order.id}
              >
                <div>
                  <p className="font-medium text-[#173f35]">{order.order_number}</p>
                  <p className="text-xs text-[#6b6b6b]">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Status</p>
                  <p className="mt-1 capitalize text-[#173f35]">{order.status.replaceAll("_", " ")}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Method</p>
                  <p className="mt-1 capitalize text-[#173f35]">{order.fulfillment_method === "local_pickup" ? "Local pickup" : "Delivery"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Payment</p>
                  <p className="mt-1 capitalize text-[#173f35]">{order.payment_status}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Location</p>
                  <p className="mt-1 text-sm text-[#173f35]">{deliveryLocation}</p>
                  <p className="mt-2 font-medium text-[#173f35]">${Number(order.total).toFixed(2)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
