import Link from "next/link";
import { isCarrierFulfillment } from "@/src/lib/orders/timeline";

export function AdminOrderPrintActions({
  orderId,
  fulfillmentMethod,
  fulfillmentProvider,
}: {
  orderId: string;
  fulfillmentMethod?: string | null;
  fulfillmentProvider?: string | null;
}) {
  const shippingSheet = fulfillmentMethod === "delivery";
  const links = [
    { kind: "packing-slip", label: "Print Packing Slip" },
    { kind: "receipt", label: "Print Customer Receipt" },
    { kind: "summary", label: "Print Order Summary" },
    ...(shippingSheet ? [{ kind: "delivery", label: isCarrierFulfillment(fulfillmentProvider) ? "Print Shipping Sheet" : "Print Delivery Sheet" }] : []),
  ];
  return (
    <section className="rounded-2xl border border-[#173f35]/10 bg-white p-4">
      <h2 className="font-semibold text-[#173f35]">Print</h2>
      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        {links.map((item) => (
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-[#173f35]/20 px-3 text-sm font-semibold text-[#173f35]"
            href={`/admin/print/orders/${orderId}?kind=${item.kind}`}
            key={item.kind}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
