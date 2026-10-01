"use client";

import Link from "next/link";
import { useState } from "react";
import { ORDER_PRINT_KINDS, orderPrintTitle, type OrderPrintKind } from "@/src/lib/print/kinds";

export function AdminOrderPrintControl({ orderId }: { orderId: string }) {
  const [kind, setKind] = useState<OrderPrintKind>("packing-slip");
  return (
    <form
      className="flex min-w-0 flex-wrap items-end gap-3 rounded-2xl border border-[#173f35]/10 bg-white p-4"
      action={`/admin/print/orders/${orderId}`}
      method="get"
    >
      <label className="min-w-0 flex-1 text-sm font-medium text-[#173f35]">
        Print
        <select
          className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3 py-2"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as OrderPrintKind)}
        >
          {ORDER_PRINT_KINDS.map((value) => (
            <option key={value} value={value}>
              {orderPrintTitle(value)}
            </option>
          ))}
        </select>
      </label>
      <Link
        className="inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white"
        href={`/admin/print/orders/${orderId}?kind=${encodeURIComponent(kind)}`}
      >
        Preview / Print
      </Link>
    </form>
  );
}
