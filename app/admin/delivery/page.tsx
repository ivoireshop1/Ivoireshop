import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings } from "@/src/lib/delivery/origin";
import { doordashCredentials, upsCredentials, uspsCredentials } from "@/src/lib/delivery/credentials";
import { checkDeliveryProviders } from "@/src/lib/delivery/actions";
import { DeliveryOriginForm } from "@/src/components/admin/delivery-origin-form";

function statusLabel(configured: boolean, health?: { status?: string | null; last_check_at?: string | null; last_error?: string | null }) {
  if (!configured) return { title: "Not configured", detail: "Add server environment credentials. Secrets never appear here." };
  if (health?.status === "connected") return { title: "Connected", detail: health.last_check_at ? `Last check ${new Date(health.last_check_at).toLocaleString()}` : "Verified" };
  if (health?.status === "error") return { title: "Error", detail: health.last_error || "Verification failed" };
  if (health?.status === "disabled") return { title: "Disabled", detail: "Turned off for new checkout quotes." };
  return { title: "Configured", detail: "Credentials are present. Run a connection check to verify." };
}

export default async function AdminDeliveryPage() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: health }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle(),
    supabase.from("delivery_provider_health").select("provider, status, last_check_at, last_error"),
  ]);
  const origin = originFromSettings(settings);
  const healthBy = new Map((health ?? []).map((row) => [row.provider, row]));
  const cards = [
    { id: "doordash", name: "DoorDash", copy: "Local delivery with DoorDash drivers. Dispatch stays off until payment is paid.", configured: doordashCredentials().configured, enabled: Boolean(settings?.doordash_enabled) },
    { id: "ups", name: "UPS", copy: "Carrier shipping rates. No invented prices.", configured: upsCredentials().configured, enabled: Boolean(settings?.ups_enabled) },
    { id: "usps", name: "USPS", copy: "USPS retail rates when credentials verify.", configured: uspsCredentials().configured, enabled: Boolean(settings?.usps_enabled) },
  ];

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Fulfillment</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Delivery Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          Configure store origin and provider switches. Live rates only appear at checkout after credentials verify. DoorDash dispatch is not created for unpaid orders.
        </p>
      </div>

      <form action={checkDeliveryProviders}>
        <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-medium text-[#173f35]" type="submit">
          Check provider connections
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => {
          const state = statusLabel(card.configured, healthBy.get(card.id));
          return (
            <section className="rounded-2xl bg-white p-5" key={card.id}>
              <h2 className="font-semibold text-[#173f35]">{card.name}</h2>
              <p className="mt-2 text-sm text-[#6b6b6b]">{card.copy}</p>
              <p className="mt-4 text-sm font-medium text-[#173f35]">{state.title}{card.enabled ? "" : " · Off for checkout"}</p>
              <p className="mt-1 text-xs text-[#6b6b6b]">{state.detail}</p>
            </section>
          );
        })}
      </div>

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
