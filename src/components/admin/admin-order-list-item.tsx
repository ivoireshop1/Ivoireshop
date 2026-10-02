import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { orderStatusLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { fulfillmentDisplay } from "@/src/lib/delivery/labels";
import { carrierOpsLines } from "@/src/lib/delivery/tracking";
import { isAdminNewOrder } from "@/src/lib/orders/buckets";
import { formatStoreCompact } from "@/src/lib/store/timezone";
import { fulfillmentKindLabel, orderAttention, trackingRequiredMissing } from "@/src/lib/orders/ops";
import { catalogImageFromProduct, orderLineImage } from "@/src/lib/orders/line-image";
import { isNextImageSrc } from "@/src/lib/catalog/image-url";

export type AdminOrderListItemData = {
  id: string;
  order_number: string;
  confirmation_code: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone?: string | null;
  total: number | string;
  status: string;
  payment_status: string;
  payment_provider: string | null;
  fulfillment_method: string | null;
  fulfillment_provider?: string | null;
  fulfillment_service?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  created_at: string;
  order_items?: Array<{
    product_name: string;
    quantity: number;
    image_url?: string | null;
    products?: { product_images?: Array<{ image_url: string; position: number }> | null } | Array<{ product_images?: Array<{ image_url: string; position: number }> | null }> | null;
  }>;
};

const columnsClass =
  "grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-[minmax(12rem,1.7fr)_minmax(11rem,1.35fr)_auto_minmax(8rem,0.95fr)_minmax(8rem,0.95fr)_auto] @4xl:items-start @4xl:gap-x-5 @4xl:gap-y-0";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] @4xl:sr-only">{label}</p>
      <div className="mt-1 @4xl:mt-0">{children}</div>
    </div>
  );
}

export function AdminOrderListHeader() {
  return (
    <div
      aria-hidden
      className={`hidden px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] @4xl:grid ${columnsClass}`}
    >
      <span>Order / Confirmation</span>
      <span>Customer</span>
      <span>Total</span>
      <span>Payment</span>
      <span>Fulfillment</span>
      <span>Date</span>
    </div>
  );
}

export function AdminOrderListItem({ order }: { order: AdminOrderListItemData }) {
  const fulfillment = order.fulfillment_method ?? "local_pickup";
  const shipping = carrierOpsLines(order);
  const attention = orderAttention(order);
  const kind = fulfillmentKindLabel(order.fulfillment_method, order.fulfillment_provider);
  const items = order.order_items ?? [];
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const missingTracking = trackingRequiredMissing(order);

  return (
    <Link
      className={`grid ${columnsClass} rounded-2xl border border-[#173f35]/10 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.04)] transition hover:border-[#173f35]/20`}
      href={`/admin/orders/${order.id}`}
    >
      <Field label="Order">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-medium text-[#173f35] [overflow-wrap:anywhere]">{order.order_number}</p>
          {isAdminNewOrder(order.status) ? (
            <span className="rounded-full bg-[#b8964c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">NEW</span>
          ) : null}
          <span className="rounded-full bg-[#173f35]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#173f35]">{kind === "Store Pickup" ? "Pickup" : kind === "Local Delivery" ? "Local Delivery" : kind}</span>
          {attention ? <span className="rounded-full border border-[#173f35]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#173f35]">{attention}</span> : null}
          {missingTracking ? <span className="rounded-full bg-[#f3efe9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7c5d1a]">Missing Tracking</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {items.slice(0, 4).map((item, index) => {
            const src = orderLineImage({
              product_name: item.product_name,
              product_price: 0,
              quantity: item.quantity,
              image_url: item.image_url,
              catalog_image_url: catalogImageFromProduct(item.products),
            });
            return (
              <span className="relative h-10 w-10 overflow-hidden rounded-lg bg-[#eadfce]" key={`${item.product_name}-${index}`}>
                {src && isNextImageSrc(src) ? <Image alt="" className="object-cover" fill sizes="40px" src={src} unoptimized /> : null}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-[#6b6b6b]">{itemCount} item{itemCount === 1 ? "" : "s"}</p>
        {order.confirmation_code ? (
          <p className="mt-1 font-mono text-sm tracking-widest whitespace-nowrap text-[#173f35]">{order.confirmation_code}</p>
        ) : null}
      </Field>
      <Field label="Customer">
        <p className="font-medium text-[#173f35]">{order.customer_name || "Customer"}</p>
        <p className="mt-1 break-words text-sm leading-5 text-[#6b6b6b] [overflow-wrap:anywhere]">{order.customer_email}</p>
      </Field>
      <Field label="Total">
        <p className="whitespace-nowrap font-medium tabular-nums text-[#173f35]">${Number(order.total).toFixed(2)}</p>
      </Field>
      <Field label="Payment">
        <p className="text-[#173f35]">{paymentStatusLabel(order.payment_status, order.payment_provider)}</p>
      </Field>
      <Field label="Fulfillment">
        {shipping ? (
          <>
            <p className="text-[#173f35]">{shipping.headline}</p>
            <p className="mt-1 text-sm leading-5 text-[#6b6b6b]">{shipping.detail}</p>
          </>
        ) : (
          <>
            <p className="text-[#173f35]">{orderStatusLabel(order.status, fulfillment, order.fulfillment_provider)}</p>
            <p className="mt-1 text-sm leading-5 text-[#6b6b6b]">{fulfillmentDisplay(order)}</p>
          </>
        )}
      </Field>
      <Field label="Date">
        <p className="whitespace-nowrap text-[#173f35]">{formatStoreCompact(order.created_at)}</p>
      </Field>
    </Link>
  );
}
