import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings } from "@/src/lib/delivery/origin";
import { doordashCredentials } from "@/src/lib/delivery/credentials";
import { checkDeliveryProviders, carrierOrderCounts } from "@/src/lib/delivery/actions";
import { DeliveryOriginForm } from "@/src/components/admin/delivery-origin-form";
import { ManualShippingForm } from "@/src/components/admin/manual-shipping-form";
import { formatCharge } from "@/src/lib/delivery/manual";
import { taxModeLabel, parseTaxMode } from "@/src/lib/tax/totals";
import Link from "next/link";

export default async function AdminDeliveryPage() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: health }, counts] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle(),
    supabase.from("delivery_provider_health").select("provider, status, last_check_at, last_error"),
    carrierOrderCounts(),
  ]);
  const origin = originFromSettings(settings);
  const healthBy = new Map((health ?? []).map((row) => [row.provider, row]));
  const doorConfigured = doordashCredentials().configured;
  const doorHealth = healthBy.get("doordash");
  const doorTitle = !doorConfigured
    ? "Not configured"
    : doorHealth?.status === "connected"
      ? "Connected"
      : doorHealth?.status === "error"
        ? "Error"
        : "Configured";
  const taxMode = parseTaxMode(settings?.tax_mode);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Fulfillment</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Delivery Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          UPS and USPS run in manual mode. Admin sets the Ivoire Shop shipping charge, then enters the real tracking number after posting the package. DoorDash remains API-based when credentials exist.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link className="rounded-2xl bg-white p-4" href="/admin/orders?shipping=awaiting">
          <p className="text-sm text-[#6b6b6b]">Awaiting shipment</p>
          <p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.awaiting}</p>
        </Link>
        <Link className="rounded-2xl bg-white p-4" href="/admin/orders?shipping=shipped">
          <p className="text-sm text-[#6b6b6b]">Shipped</p>
          <p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.shipped}</p>
        </Link>
        <Link className="rounded-2xl bg-white p-4" href="/admin/orders?shipping=missing-tracking">
          <p className="text-sm text-[#6b6b6b]">Missing tracking</p>
          <p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.missingTracking}</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">UPS</h2>
          <p className="mt-2 text-sm text-[#6b6b6b]">Manual Shipping</p>
          <p className="mt-4 text-sm font-medium text-[#173f35]">Manual Mode{settings?.ups_enabled ? "" : " · Off for checkout"}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">Domestic: {settings?.ups_domestic_enabled ? formatCharge(settings.ups_domestic_charge) : "Off"}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">International: {settings?.ups_international_enabled ? formatCharge(settings.ups_international_charge) : "Off"}</p>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">USPS</h2>
          <p className="mt-2 text-sm text-[#6b6b6b]">Manual Shipping</p>
          <p className="mt-4 text-sm font-medium text-[#173f35]">Manual Mode{settings?.usps_enabled ? "" : " · Off for checkout"}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">Domestic: {settings?.usps_domestic_enabled ? formatCharge(settings.usps_domestic_charge) : "Off"}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">International: {settings?.usps_international_enabled ? formatCharge(settings.usps_international_charge) : "Off"}</p>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">DoorDash</h2>
          <p className="mt-2 text-sm text-[#6b6b6b]">API / Local Delivery</p>
          <p className="mt-4 text-sm font-medium text-[#173f35]">{doorTitle}{settings?.doordash_enabled ? "" : " · Off for checkout"}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">
            {doorConfigured
              ? doorHealth?.last_error || (doorHealth?.last_check_at ? `Last check ${new Date(doorHealth.last_check_at).toLocaleString()}` : "Credentials present. Run a connection check to verify.")
              : "Not configured until credentials exist."}
          </p>
        </section>
      </div>

      <form action={checkDeliveryProviders}>
        <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-medium text-[#173f35]" type="submit">
          Check DoorDash connection
        </button>
      </form>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Tax</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">{taxModeLabel(taxMode)}</p>
        {taxMode === "not_configured" ? <p className="mt-2 text-sm text-[#7c5d1a]">Tax configuration required</p> : null}
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline" href="/admin/payments">
          Open tax settings
        </Link>
      </section>

      <ManualShippingForm settings={settings} />
      <DeliveryOriginForm
        doordashEnabled={Boolean(settings?.doordash_enabled)}
        origin={origin}
        pickupEnabled={settings?.pickup_enabled !== false}
        radius={settings?.doordash_max_radius_miles}
        storeDeliveryEnabled={settings?.store_delivery_enabled !== false}
        upsEnabled={Boolean(settings?.ups_enabled)}
        uspsEnabled={Boolean(settings?.usps_enabled)}
      />
    </div>
  );
}
