"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { purchaseUpsLabel, reviewUpsLabel, type UpsLabelActionState } from "@/src/lib/shipping/easyship-label-actions";

const LABEL_CONFIRM = "buy-reviewed-ups-label";

type HistoryRow = {
  id: string;
  status: string;
  serviceName: string | null;
  labelCost: number | null;
  trackingNumber: string | null;
  errorMessage: string | null;
  createdAt: string;
  purchasedAt: string | null;
  labelReady: boolean;
  shipmentId: string | null;
};

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function ReviewButton() {
  const { pending } = useFormStatus();
  return <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" disabled={pending} type="submit">{pending ? "Checking rate…" : "Get current UPS label cost"}</button>;
}

function BuyButton() {
  const { pending } = useFormStatus();
  return <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white" disabled={pending} type="submit">{pending ? "Buying…" : "Buy this UPS label"}</button>;
}

export function AdminUpsLabelPanel({
  orderId,
  customerShipping,
  service,
  purchasesEnabled,
  history,
  historyError,
  purchased,
}: {
  orderId: string;
  customerShipping: number | null;
  service: string | null;
  purchasesEnabled: boolean;
  history: HistoryRow[];
  historyError: boolean;
  purchased: boolean;
}) {
  const [review, reviewAction] = useActionState(reviewUpsLabel, null as UpsLabelActionState | null);
  const [purchase, purchaseAction] = useActionState(purchaseUpsLabel, null as UpsLabelActionState | null);
  const state = purchase?.reviewed || purchase?.purchased || purchase?.error ? purchase : review;
  const labelCost = state?.labelCost ?? null;
  const bought = purchased || Boolean(state?.purchased) || history.some((row) => row.status === "purchased");
  const fileReady = Boolean(state?.labelReady) || history.some((row) => row.labelReady);
  const canBuy = Boolean(state?.reviewed && state.courierServiceId && labelCost != null && !bought && !state.held && !state.error);
  const failedWithoutShipment = history.some((row) => row.status === "failed" && !row.shipmentId) && !history.some((row) => row.shipmentId || row.status === "purchased" || row.status === "purchasing");

  return (
    <section className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">UPS label</h2>
      <p className="mt-2 text-sm text-[#6b6b6b]">Saved service: {service || "Not stored"}. Customer shipping charge: {money(customerShipping)}.</p>
      <p className="mt-1 text-sm text-[#6b6b6b]">{purchasesEnabled ? "Label purchasing is founder-approved on this server." : "Label purchasing is off. A rate can be reviewed, and postage is not bought."}</p>
      {historyError ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Label history needs the easyship label migration. It has not been applied, so nothing can be purchased.</p> : null}
      {state?.error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      {state?.reviewed && labelCost != null ? (
        <dl className="mt-4 grid gap-2 text-sm text-[#173f35] sm:grid-cols-3">
          <div><dt className="text-[#6b6b6b]">Customer shipping charge</dt><dd>{money(state.customerShipping ?? customerShipping)}</dd></div>
          <div><dt className="text-[#6b6b6b]">Current label cost</dt><dd>{money(labelCost)}{state.service ? ` · ${state.service}` : ""}</dd></div>
          <div><dt className="text-[#6b6b6b]">Difference</dt><dd>{money(state.difference)}</dd></div>
        </dl>
      ) : null}
      {state?.shipmentCharge != null || state?.fuelSurcharge != null ? (
        <p className="mt-2 text-sm text-[#6b6b6b]">Easyship total includes the courier charge {money(state?.shipmentCharge)} and fuel {money(state?.fuelSurcharge)} when those parts are listed. The purchase uses the total.</p>
      ) : null}
      {state?.notification === "tracking_added" ? <p className="mt-3 text-sm text-[#173f35]">Tracking was saved, then the customer tracking notification was recorded.</p> : null}
      <form action={reviewAction} className="mt-4">
        <input name="order_id" type="hidden" value={orderId} />
        <ReviewButton />
      </form>
      {canBuy ? (
        <form action={purchaseAction} className="mt-4 space-y-3">
          <input name="order_id" type="hidden" value={orderId} />
          <input name="reviewed_amount" type="hidden" value={String(labelCost)} />
          <input name="reviewed_service_id" type="hidden" value={state?.courierServiceId ?? ""} />
          <input name="retry_mode" type="hidden" value="same" />
          <label className="block text-sm text-[#173f35]">
            Type {LABEL_CONFIRM} to confirm this exact postage purchase.
            <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" name="confirm" autoComplete="off" required />
          </label>
          <label className="flex items-start gap-2 text-sm text-[#173f35]">
            <input className="mt-1" name="acknowledged" required type="checkbox" />
            I reviewed this UPS service and cost. Buy this label only.
          </label>
          <BuyButton />
        </form>
      ) : null}
      {failedWithoutShipment ? (
        <form action={purchaseAction} className="mt-4 space-y-3">
          <input name="order_id" type="hidden" value={orderId} />
          <input name="reviewed_amount" type="hidden" value={labelCost == null ? "" : String(labelCost)} />
          <input name="reviewed_service_id" type="hidden" value={state?.courierServiceId ?? ""} />
          <input name="retry_mode" type="hidden" value="new" />
          <label className="block text-sm text-[#173f35]">
            Start a new attempt only when the failed request did not create a shipment. Type {LABEL_CONFIRM}.
            <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" name="confirm" autoComplete="off" required />
          </label>
          <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" type="submit">Retry as a new attempt</button>
        </form>
      ) : null}
      {fileReady ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="inline-flex min-h-11 items-center rounded-xl border border-[#173f35]/20 px-3 text-sm font-semibold text-[#173f35]" href={`/api/admin/orders/${orderId}/easyship-label?download=1`}>Download Label</a>
          <a className="inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-3 text-sm font-semibold text-white" href={`/admin/orders/${orderId}/label`}>Print Label</a>
        </div>
      ) : null}
      <h3 className="mt-6 text-sm font-semibold text-[#173f35]">Purchase history</h3>
      {!history.length ? <p className="mt-2 text-sm text-[#6b6b6b]">No label attempts yet.</p> : (
        <ul className="mt-2 space-y-2 text-sm">
          {history.map((row) => (
            <li className="rounded-xl bg-[#f7f4ee] px-3 py-2" key={row.id}>
              <span className="font-medium uppercase">{row.status}</span>
              {row.serviceName ? ` · ${row.serviceName}` : ""} · {money(row.labelCost)}
              {row.trackingNumber ? ` · ${row.trackingNumber}` : ""}
              {row.errorMessage ? <span className="mt-1 block text-red-800">{row.errorMessage}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
