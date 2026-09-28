import type { ReactNode } from "react";
import Link from "next/link";
import { orderStatusLabel, paymentStatusLabel } from "@/src/lib/orders/status";

export type AdminOrderListItemData = {
  id: string;
  order_number: string;
  confirmation_code: string | null;
  customer_name: string | null;
  customer_email: string | null;
  total: number | string;
  status: string;
  payment_status: string;
  payment_provider: string | null;
  fulfillment_method: string | null;
  created_at: string;
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

  return (
    <Link
      className={`grid ${columnsClass} rounded-2xl border border-[#173f35]/10 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.04)] transition hover:border-[#173f35]/20`}
      href={`/admin/orders/${order.id}`}
    >
      <Field label="Order">
        <p className="break-words font-medium text-[#173f35] [overflow-wrap:anywhere]">{order.order_number}</p>
        {order.confirmation_code ? (
          <>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] @4xl:sr-only">Confirmation</p>
            <p className="mt-1 font-mono text-sm tracking-widest whitespace-nowrap text-[#173f35] @4xl:mt-2">
              {order.confirmation_code}
            </p>
          </>
        ) : null}
      </Field>
      <Field label="Customer">
        <p className="font-medium text-[#173f35]">{order.customer_name || "Customer"}</p>
        <p className="mt-1 break-words text-sm leading-5 text-[#6b6b6b] [overflow-wrap:anywhere]">
          {order.customer_email}
        </p>
      </Field>
      <Field label="Total">
        <p className="whitespace-nowrap font-medium tabular-nums text-[#173f35]">${Number(order.total).toFixed(2)}</p>
      </Field>
      <Field label="Payment">
        <p className="text-[#173f35]">{paymentStatusLabel(order.payment_status, order.payment_provider)}</p>
        <p className="mt-1 text-sm capitalize leading-5 text-[#6b6b6b]">
          {(order.payment_provider || "To be collected").replaceAll("_", " ")}
        </p>
      </Field>
      <Field label="Fulfillment">
        <p className="text-[#173f35]">{orderStatusLabel(order.status, fulfillment)}</p>
        <p className="mt-1 text-sm capitalize leading-5 text-[#6b6b6b]">
          {order.fulfillment_method?.replaceAll("_", " ")}
        </p>
      </Field>
      <Field label="Date">
        <p className="whitespace-nowrap text-[#173f35]">{new Date(order.created_at).toLocaleDateString()}</p>
      </Field>
    </Link>
  );
}
