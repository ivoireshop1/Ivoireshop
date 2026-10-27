import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";
import { ozToLb, weightSourceBadge } from "@/src/lib/catalog/shipping-weight";
import { redactShippingDiagnostics } from "@/src/lib/shipping/redact";
import { shippingLiveRatesSwitch } from "@/src/lib/shipping/live-rates-switch";
import { parcelUsedEstimatedBox } from "@/src/lib/shipping/shipping-quote-log";

export default async function AdminShippingWeightsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: estimatedProducts, error: estimatedError }, { data: reviewProducts, error: reviewError }, { data: logs, error: logError }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, is_active, weight_oz, item_weight_lb, weight_source, weight_confidence, packaging_weight_oz")
      .in("weight_source", ["ai_text", "ai_image", "ai_estimate"])
      .order("name"),
    supabase
      .from("products")
      .select("id, name, slug, is_active, weight_oz, item_weight_lb, weight_source, weight_confidence")
      .eq("is_active", true)
      .or("weight_source.is.null,weight_source.neq.verified")
      .order("name")
      .limit(80),
    supabase
      .from("shipping_quote_logs")
      .select("id, used_estimated_weight, weight_sources, parcel, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (estimatedError || reviewError || logError) {
    return <AdminLoadFailure message="Unable to load shipping monitor." title="Shipping" />;
  }

  const liveRatesSwitch = shippingLiveRatesSwitch();
  const rows = (logs ?? []).map((row) => ({
    ...row,
    message: redactShippingDiagnostics(row.message),
    weight_sources: redactShippingDiagnostics(row.weight_sources),
    parcel: redactShippingDiagnostics(row.parcel),
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Fulfillment</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Shipping monitor</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          Checkout quoting prefers verified weights and measured boxes. When those are missing, configured category estimates and labeled estimated box presets may be used. Estimated values are never treated as measured cartons or carrier-approved packaging. Pickup stays available when a delivery quote cannot be built.
          Emergency switch SHIPPING_LIVE_RATES_ENABLED: <strong>{liveRatesSwitch.toUpperCase()}</strong>.
          When that switch is unset, checkout follows the saved Easyship or EasyPost customer-rate activation. An explicit off value stops live quotes. Shippo still requires the switch to be on.
        </p>
        <p className="mt-2 text-sm">
          <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/delivery">Delivery Center</Link>
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white">
        <div className="px-4 py-3">
          <h2 className="font-semibold text-[#173f35]">Products requiring review</h2>
          <p className="mt-1 text-sm text-[#6b6b6b]">Active catalog rows without a verified shipping weight. Search or AI results are never treated as verified measurements.</p>
        </div>
        {(reviewProducts ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#6b6b6b]">Every active product has a verified shipping weight.</p>
        ) : (
          <ul className="divide-y divide-[#173f35]/10">
            {(reviewProducts ?? []).map((product) => {
              const badge = weightSourceBadge(product.weight_source, product.weight_confidence);
              const oz = Number(product.weight_oz);
              const lb = Number.isFinite(oz) && oz > 0 ? ozToLb(oz) : Number(product.item_weight_lb);
              return (
                <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={product.id}>
                  <div>
                    <Link className="font-semibold text-[#173f35] underline-offset-4 hover:underline" href={`/admin/products/${product.id}`}>
                      {product.name}
                    </Link>
                    <p className="text-sm text-[#6b6b6b]">
                      {Number.isFinite(lb) ? `${lb} lb` : "No shipping weight"}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">{badge.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white">
        <div className="px-4 py-3">
          <h2 className="font-semibold text-[#173f35]">Stored estimate flags</h2>
          <p className="mt-1 text-sm text-[#6b6b6b]">These rows already have an identified estimate source. They do not overwrite verified weights.</p>
        </div>
        {(estimatedProducts ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#6b6b6b]">No estimated weights are stored yet.</p>
        ) : (
          <ul className="divide-y divide-[#173f35]/10">
            {(estimatedProducts ?? []).map((product) => {
              const badge = weightSourceBadge(product.weight_source, product.weight_confidence);
              return (
                <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={product.id}>
                  <Link className="font-semibold text-[#173f35] underline-offset-4 hover:underline" href={`/admin/products/${product.id}`}>
                    {product.name}
                  </Link>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">{badge.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="text-lg font-semibold text-[#173f35]">Latest 50 quote attempts</h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Status, estimate flags, and carrier outcomes. API keys, customer addresses, and tokens are redacted. One-off Admin probe diagnostics stay on Delivery Center.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-[#173f35]">
          {rows.length === 0 ? <li className="text-[#6b6b6b]">No shipping quote logs yet.</li> : null}
          {rows.map((row) => (
            <li className="rounded-xl border border-[#173f35]/10 px-3 py-2" key={row.id}>
              <p>
                {new Date(row.created_at).toLocaleString()}
                {" · "}
                {String(row.status || "ok")}
                {" · "}
                {row.used_estimated_weight ? "Estimated weight used" : "Verified or selected weight used"}
                {" · "}
                {parcelUsedEstimatedBox(row.parcel) ? "Estimated box used" : "Measured box or product package used"}
              </p>
              <p className="text-[#6b6b6b]">{typeof row.message === "string" ? row.message : "Quote recorded"}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
