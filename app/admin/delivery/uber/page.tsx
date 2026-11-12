import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { UberDirectPanel } from "@/src/components/admin/uber-direct-panel";
import {
  credentialStatusSummary,
  explainUberCheckoutBlocker,
  explainUberDispatchBlocker,
  uberDirectCredentials,
  uberDirectEnvironment,
  uberDispatchAllowed,
} from "@/src/lib/delivery/credentials";

export default async function AdminUberDirectPage() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: healthRows }, deliveriesQuery, quoteEventsQuery] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle(),
    supabase.from("delivery_provider_health").select("provider, status, last_check_at, last_error").eq("provider", "uber").maybeSingle(),
    supabase.from("uber_deliveries").select("order_id, delivery_id, status, tracking_url, fee_cents, markup_cents, courier_name, last_error, environment").order("created_at", { ascending: false }).limit(40),
    supabase.from("uber_quote_events").select("id, kind, message, fee_cents, environment, source, created_at").order("created_at", { ascending: false }).limit(40),
  ]);
  const uberDeliveryRows = deliveriesQuery.error ? [] : (deliveriesQuery.data ?? []);
  const quoteEvents = quoteEventsQuery.error ? [] : (quoteEventsQuery.data ?? []);
  const uberOrderIds = (uberDeliveryRows ?? []).map((row) => row.order_id);
  const { data: uberOrders } = uberOrderIds.length
    ? await supabase.from("orders").select("id, payment_status, refunded_amount").in("id", uberOrderIds)
    : { data: [] as Array<{ id: string; payment_status: string | null; refunded_amount: number | null }> };
  const uberPayment = new Map((uberOrders ?? []).map((row) => [row.id, row]));
  const uberDeliveries = (uberDeliveryRows ?? []).map((row) => ({
    ...row,
    payment_status: uberPayment.get(row.order_id)?.payment_status ?? null,
    refunded_amount: uberPayment.get(row.order_id)?.refunded_amount ?? null,
  }));
  const uberCreds = uberDirectCredentials();
  const credentials = credentialStatusSummary();
  const gate = {
    enabled: settings?.uber_direct_enabled === true,
    showAtCheckout: settings?.uber_direct_show_at_checkout === true,
    productionDispatchDb: settings?.uber_direct_production_dispatch === true,
  };
  const checkoutBlocker = explainUberCheckoutBlocker(gate);
  const dispatchBlocker = explainUberDispatchBlocker(gate);
  const dispatchAllowed = uberDispatchAllowed() && (uberDirectEnvironment() !== "production" || gate.productionDispatchDb);
  const health = healthRows?.status || (uberCreds.configured ? "Not checked" : "missing");
  const settingsRow = (settings ?? {}) as Record<string, unknown>;
  const minMiles = settingsRow.uber_direct_min_miles == null ? null : Number(settingsRow.uber_direct_min_miles);
  const maxMiles = settingsRow.uber_direct_max_miles == null ? null : Number(settingsRow.uber_direct_max_miles);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Fulfillment</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Uber Direct</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          Dedicated controls for Uber local delivery quotes and connection health. Pickup and existing local delivery stay on the main Delivery Center.
        </p>
        <p className="mt-2 text-sm">
          <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/delivery">Back to Delivery Center</Link>
        </p>
      </div>

      <UberDirectPanel
        checkoutBlocker={checkoutBlocker}
        configured={uberCreds.configured}
        credentials={credentials}
        deliveries={uberDeliveries}
        dispatchAllowed={dispatchAllowed}
        dispatchBlocker={dispatchBlocker}
        enabled={settings?.uber_direct_enabled === true}
        environment={uberCreds.environment}
        health={health}
        lastCheckAt={healthRows?.last_check_at ?? null}
        lastError={healthRows?.last_error ?? null}
        markupCents={Number(settings?.uber_direct_markup_cents ?? 0)}
        maxMiles={Number.isFinite(maxMiles) ? maxMiles : null}
        minMiles={Number.isFinite(minMiles) ? minMiles : null}
        productionDispatch={settings?.uber_direct_production_dispatch === true}
        quoteEvents={quoteEvents as Array<{ id: string; kind: string; message: string | null; fee_cents: number | null; environment: string | null; source: string | null; created_at: string }>}
        showAtCheckout={settings?.uber_direct_show_at_checkout === true}
      />
      {deliveriesQuery.error || quoteEventsQuery.error ? (
        <p className="rounded-xl border border-[#b8964c]/40 bg-[#fbf7ee] p-4 text-sm text-[#7c5d1a]">
          Uber history tables are not fully available yet. Apply the Uber Direct migrations, then refresh this page.
        </p>
      ) : null}
    </div>
  );
}
