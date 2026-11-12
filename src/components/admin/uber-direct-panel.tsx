"use client";

import { useActionState } from "react";
import {
  cancelUberOrderDelivery,
  checkUberDirectConnection,
  retryUberOrderDelivery,
  saveUberDirectSettings,
  testUberDirectQuote,
} from "@/src/lib/delivery/uber-actions";

type DeliveryRow = {
  order_id: string;
  delivery_id: string | null;
  status: string | null;
  tracking_url: string | null;
  fee_cents: number | null;
  markup_cents: number | null;
  courier_name: string | null;
  last_error: string | null;
  environment: string | null;
  payment_status?: string | null;
  refunded_amount?: number | null;
};

type QuoteEvent = {
  id: string;
  kind: string;
  message: string | null;
  fee_cents: number | null;
  environment: string | null;
  source: string | null;
  created_at: string;
};

type CredentialStatus = {
  configured: boolean;
  environment: string;
  customerIdPresent: boolean;
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  webhookSigningKeyPresent: boolean;
  productionDispatchEnv: boolean;
  quotesAllowed: boolean;
  dispatchAllowed: boolean;
};

export function UberDirectPanel({
  enabled,
  showAtCheckout,
  productionDispatch,
  markupCents,
  minMiles,
  maxMiles,
  environment,
  configured,
  dispatchAllowed,
  health,
  lastCheckAt,
  lastError,
  checkoutBlocker,
  dispatchBlocker,
  credentials,
  deliveries,
  quoteEvents,
}: {
  enabled: boolean;
  showAtCheckout: boolean;
  productionDispatch: boolean;
  markupCents: number;
  minMiles: number | null;
  maxMiles: number | null;
  environment: string;
  configured: boolean;
  dispatchAllowed: boolean;
  health: string;
  lastCheckAt: string | null;
  lastError: string | null;
  checkoutBlocker: string | null;
  dispatchBlocker: string | null;
  credentials: CredentialStatus;
  deliveries: DeliveryRow[];
  quoteEvents: QuoteEvent[];
}) {
  const [state, save] = useActionState(saveUberDirectSettings, null);
  const [quoteState, runQuote] = useActionState(testUberDirectQuote, null);
  const availability = checkoutAvailabilityLabel({ enabled, showAtCheckout, checkoutBlocker, configured, environment });

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Admin → Delivery → Uber Direct</p>
        <h2 className="mt-2 font-semibold text-[#173f35]">Uber Direct</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">
          Manage local courier quotes at checkout. Paid driver dispatch stays separately protected and is not turned on by saving these settings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Connection" value={healthLabel(health)} detail={lastError || (lastCheckAt ? `Last check ${new Date(lastCheckAt).toLocaleString()}` : "Not checked yet")} />
        <StatusCard label="Environment" value={environment} detail={credentials.quotesAllowed ? "API host identified" : "Set UBER_DIRECT_ENVIRONMENT"} />
        <StatusCard label="Credentials" value={configured ? "Configured" : "Missing"} detail={credentialDetail(credentials)} />
        <StatusCard label="Checkout availability" value={availability.title} detail={availability.detail} />
      </div>

      <div className="grid gap-3 rounded-xl border border-[#173f35]/10 bg-[#fbf7ee] p-4 text-sm text-[#7c5d1a]">
        <p><strong>Quotes:</strong> {checkoutBlocker ? checkoutBlocker : "Eligible when enabled, shown at checkout, and credentials authenticate."}</p>
        <p><strong>Paid dispatch:</strong> {dispatchBlocker ? dispatchBlocker : (dispatchAllowed ? "Allowed for this environment." : "Blocked.")}</p>
        <p><strong>Server flag:</strong> Production booking still requires UBER_DIRECT_PRODUCTION_DISPATCH=founder-approved. This page never sets that flag.</p>
      </div>

      <form action={save} className="grid gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input defaultChecked={enabled} name="uber_direct_enabled" type="checkbox" /> Enable Uber Direct</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input defaultChecked={showAtCheckout} name="uber_direct_show_at_checkout" type="checkbox" /> Show Uber Direct at checkout</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input defaultChecked={productionDispatch} name="uber_direct_production_dispatch" type="checkbox" /> Admin production-dispatch readiness (still needs the server founder-approved flag)</label>
        <label className="text-sm text-[#173f35]">Separately disclosed markup (cents)
          <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" defaultValue={markupCents} inputMode="numeric" name="uber_direct_markup_cents" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[#173f35]">Minimum delivery distance (miles, optional)
            <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" defaultValue={minMiles ?? ""} inputMode="decimal" max="500" min="0" name="uber_direct_min_miles" step="0.1" />
          </label>
          <label className="text-sm text-[#173f35]">Maximum delivery distance (miles, optional)
            <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" defaultValue={maxMiles ?? ""} inputMode="decimal" max="500" min="0" name="uber_direct_max_miles" step="0.1" />
          </label>
        </div>
        <p className="text-xs text-[#6b6b6b]">Mile limits are stored for store policy. Live Uber quotes still decide whether a destination is deliverable; invented fees are never shown.</p>
        <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white" type="submit">Save Uber Direct</button>
        {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
        {state?.saved ? <p className="text-sm text-[#173f35]">Saved. Settings persist after refresh.</p> : null}
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={checkUberDirectConnection} className="rounded-xl border border-[#173f35]/10 p-4">
          <h3 className="font-semibold text-[#173f35]">Test connection</h3>
          <p className="mt-1 text-sm text-[#6b6b6b]">Requests an OAuth token. Does not book a courier.</p>
          <button className="mt-3 min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" type="submit">Check API connection</button>
        </form>

        <form action={runQuote} className="rounded-xl border border-[#173f35]/10 p-4">
          <h3 className="font-semibold text-[#173f35]">Test delivery quote</h3>
          <p className="mt-1 text-sm text-[#6b6b6b]">Uses the store origin and a temporary dropoff. Does not dispatch a driver.</p>
          <div className="mt-3 grid gap-2">
            <input className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" name="dropoff_line1" placeholder="Street address" required />
            <input className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" name="dropoff_line2" placeholder="Apt / suite (optional)" />
            <div className="grid gap-2 sm:grid-cols-3">
              <input className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" name="dropoff_city" placeholder="City" required />
              <input className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" name="dropoff_state" placeholder="State" required />
              <input className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" name="dropoff_postal" placeholder="ZIP" required />
            </div>
            <input className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" defaultValue="US" name="dropoff_country" placeholder="Country" />
          </div>
          <button className="mt-3 min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" type="submit">Request test quote</button>
          {quoteState?.error ? <p className="mt-2 text-sm text-red-800">{quoteState.error}</p> : null}
          {quoteState?.ok ? <p className="mt-2 text-sm text-[#173f35]">Uber fee {quoteState.fee}{quoteState.estimate ? ` · ${quoteState.estimate}` : ""} · Customer total {quoteState.total}</p> : null}
        </form>
      </div>

      <div>
        <h3 className="font-semibold text-[#173f35]">Quote and connection history</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[#6b6b6b]">
                <th className="py-2">When</th>
                <th>Kind</th>
                <th>Source</th>
                <th>Message</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {quoteEvents.map((row) => (
                <tr className="border-t border-[#173f35]/10" key={row.id}>
                  <td className="py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.kind}</td>
                  <td>{row.source || "—"}</td>
                  <td>{row.message || "—"}</td>
                  <td>{money(row.fee_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!quoteEvents.length ? <p className="mt-3 text-sm text-[#6b6b6b]">No quote or connection events recorded yet.</p> : null}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-[#173f35]">Uber deliveries</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[#6b6b6b]">
                <th className="py-2">Status</th>
                <th>Delivery</th>
                <th>Courier</th>
                <th>Fee</th>
                <th>Payment</th>
                <th>Tracking</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((row) => (
                <tr className="border-t border-[#173f35]/10" key={row.order_id}>
                  <td className="py-2">{row.status || "accepted"}{row.last_error ? ` · ${row.last_error}` : ""}</td>
                  <td>{row.delivery_id || "Not booked"} · {row.environment}</td>
                  <td>{row.courier_name || "—"}</td>
                  <td>{money(row.fee_cents)}{row.markup_cents ? ` + ${money(row.markup_cents)} markup` : ""}</td>
                  <td>{row.payment_status || "—"}{row.refunded_amount ? ` · refunded $${Number(row.refunded_amount).toFixed(2)}` : ""}</td>
                  <td>
                    {row.tracking_url ? <a className="underline" href={row.tracking_url}>Track</a> : "—"}
                    {row.delivery_id && row.status !== "delivered" && row.status !== "cancelled" ? (
                      <button className="ml-3 underline" onClick={() => cancelUberOrderDelivery(row.order_id)} type="button">Cancel</button>
                    ) : null}
                    {!row.delivery_id && row.status === "failed" ? (
                      <button className="ml-3 underline" onClick={() => retryUberOrderDelivery(row.order_id)} type="button">Retry</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!deliveries.length ? <p className="mt-3 text-sm text-[#6b6b6b]">No Uber deliveries yet.</p> : null}
        </div>
      </div>
    </section>
  );
}

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[#173f35]/10 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[#6b6b6b]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#173f35]">{value}</p>
      <p className="mt-1 text-xs text-[#6b6b6b]">{detail}</p>
    </div>
  );
}

function healthLabel(health: string) {
  if (health === "connected") return "Connected";
  if (health === "failed" || health === "error") return "Failed";
  if (health === "missing") return "Missing credentials";
  if (health === "unidentified") return "Environment unidentified";
  return health || "Not checked";
}

function credentialDetail(credentials: CredentialStatus) {
  const parts = [
    credentials.customerIdPresent ? "customer id" : "no customer id",
    credentials.clientIdPresent ? "client id" : "no client id",
    credentials.clientSecretPresent ? "client secret" : "no client secret",
    credentials.webhookSigningKeyPresent ? "webhook key" : "no webhook key",
  ];
  return parts.join(" · ");
}

function checkoutAvailabilityLabel(input: {
  enabled: boolean;
  showAtCheckout: boolean;
  checkoutBlocker: string | null;
  configured: boolean;
  environment: string;
}) {
  if (!input.enabled) return { title: "Disabled", detail: "Turn on Enable Uber Direct to allow quotes." };
  if (!input.showAtCheckout) return { title: "Hidden", detail: "Enabled, but hidden from customers at checkout." };
  if (input.checkoutBlocker) return { title: "Blocked", detail: input.checkoutBlocker };
  return { title: "Available for quotes", detail: `Environment ${input.environment}. Credentials ${input.configured ? "present" : "missing"}.` };
}

function money(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
