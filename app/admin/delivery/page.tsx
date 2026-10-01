import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings } from "@/src/lib/delivery/origin";
import { doordashCredentials } from "@/src/lib/delivery/credentials";
import { checkDeliveryProviders, carrierOrderCounts } from "@/src/lib/delivery/actions";
import { DeliveryOriginForm } from "@/src/components/admin/delivery-origin-form";
import { ManualShippingForm } from "@/src/components/admin/manual-shipping-form";
import { formatCharge, parseRateMode, rateModeLabel } from "@/src/lib/delivery/manual";
import { TaxSettingsForm } from "@/src/components/admin/tax-settings-form";
import { parseTaxMode, taxModeLabel } from "@/src/lib/tax/totals";
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
          UPS and USPS run in Manual Mode. Admin sets the Ivoire Shop shipping charge, then enters the real tracking number after posting the package. DoorDash remains API-based when credentials exist.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link className="rounded-2xl bg-white p-4" href="/admin/orders?shipping=awaiting">
          <p className="text-sm text-[#6b6b6b]">Awaiting shipment</p>
          <p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.ok ? counts.awaiting : "—"}</p>
        </Link>
        <Link className="rounded-2xl bg-white p-4" href="/admin/orders?shipping=shipped">
          <p className="text-sm text-[#6b6b6b]">Shipped</p>
          <p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.ok ? counts.shipped : "—"}</p>
        </Link>
        <Link className="rounded-2xl bg-white p-4" href="/admin/orders?shipping=missing-tracking">
          <p className="text-sm text-[#6b6b6b]">Missing tracking</p>
          <p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.ok ? counts.missingTracking : "—"}</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">UPS</h2>
          <p className="mt-2 text-sm text-[#6b6b6b]">Manual Shipping</p>
          <p className="mt-4 text-sm font-medium text-[#173f35]">{rateModeLabel(parseRateMode(settings?.ups_rate_mode))}{settings?.ups_enabled && settings?.ups_show_at_checkout !== false ? "" : " · Hidden at checkout"}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">Domestic: {settings?.ups_domestic_enabled ? formatCharge(settings.ups_domestic_charge) : "Off"}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">International: {settings?.ups_international_enabled ? formatCharge(settings.ups_international_charge) : "Off"}</p>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">USPS</h2>
          <p className="mt-2 text-sm text-[#6b6b6b]">Manual Shipping</p>
          <p className="mt-4 text-sm font-medium text-[#173f35]">{rateModeLabel(parseRateMode(settings?.usps_rate_mode))}{settings?.usps_enabled && settings?.usps_show_at_checkout !== false ? "" : " · Hidden at checkout"}</p>
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

      {!counts.ok ? <p className="text-sm text-[#7c5d1a]">Unable to load shipping counts. Delivery settings below can still be saved.</p> : null}
      <form action={checkDeliveryProviders}>
        <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-medium text-[#173f35]" type="submit">
          Check DoorDash connection
        </button>
      </form>

      <TaxSettingsForm
        appliesToShipping={Boolean(settings?.tax_applies_to_shipping)}
        taxMode={settings?.tax_mode}
        taxName={settings?.tax_name}
        taxRate={settings?.tax_rate_percent}
      />
      {taxMode === "not_configured" ? (
        <p className="rounded-xl border border-[#b8964c]/40 bg-white p-4 text-sm text-[#7c5d1a]">
          Tax configuration required. Checkout shows Tax (not configured) and stores $0.00 tax until you choose No Tax or Manual Rate.
        </p>
      ) : (
        <p className="text-sm text-[#6b6b6b]">Tax calculation method: {taxModeLabel(taxMode)}</p>
      )}

      <ManualShippingForm settings={settings} />
      <DeliveryOriginForm
        doordashEnabled={Boolean(settings?.doordash_enabled)}
        localCharge={settings?.store_delivery_charge}
        origin={origin}
        pickupEnabled={settings?.pickup_enabled !== false}
        pickupShowAtCheckout={settings?.pickup_show_at_checkout !== false}
        radius={settings?.doordash_max_radius_miles}
        storeDeliveryEnabled={settings?.store_delivery_enabled !== false}
        storeDeliveryShowAtCheckout={settings?.store_delivery_show_at_checkout !== false}
      />
    </div>
  );
}
