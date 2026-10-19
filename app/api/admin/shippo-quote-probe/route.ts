import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings } from "@/src/lib/delivery/origin";
import {
  listShippoCarrierAccounts,
  mapShippoRates,
  parseAllowedServices,
  shippoCredentials,
} from "@/src/lib/shipping/shippo";
import { cartParcel } from "@/src/lib/shipping/live-quotes";

export const runtime = "nodejs";

const CONFIRM = "preview-shippo-quote-probe";

async function shippoRequest(path: string, init?: RequestInit) {
  const creds = shippoCredentials();
  const response = await fetch(`https://api.goshippo.com${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${creds.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Preview only." }, { status: 404 });
  }

  let body: {
    confirm?: string;
    destination?: {
      name?: string;
      address_line_1?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    productSlug?: string;
    quantity?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }
  if (body.confirm !== CONFIRM) {
    return NextResponse.json({ error: "confirm phrase required." }, { status: 403 });
  }

  const creds = shippoCredentials();
  if (!creds.configured || !creds.isTest) {
    return NextResponse.json({ error: "Shippo TEST token required." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const origin = originFromSettings(settings);
  const slug = String(body.productSlug || "fresh-plantains-staging-weight");
  const { data: product } = await supabase
    .from("products")
    .select("id, slug, selling_method, selling_unit, unit_increment, min_sell_qty, max_sell_qty, package_weight_lb, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
    .eq("slug", slug)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: `Product ${slug} not found.` }, { status: 404 });
  }

  const quantity = Number(body.quantity ?? 1);
  const packed = cartParcel([{ ...product, quantity }]);
  if (!packed.parcel) {
    return NextResponse.json({ error: "Parcel could not be built from product shipping data.", packed }, { status: 422 });
  }

  const destination = {
    name: body.destination?.name || "Checkout Probe",
    address_line_1: body.destination?.address_line_1 || "1009 Redwood Rd",
    city: body.destination?.city || "Clayton",
    state: body.destination?.state || "OH",
    postal_code: body.destination?.postal_code || "45315",
    country: body.destination?.country || "US",
  };

  const accounts = await listShippoCarrierAccounts();
  const result = await shippoRequest("/shipments/", {
    method: "POST",
    body: JSON.stringify({
      address_from: {
        name: "Ivoire Shop",
        street1: origin.address_line_1,
        street2: origin.address_line_2 || "",
        city: origin.city,
        state: origin.state,
        zip: origin.postal_code,
        country: "US",
        phone: origin.phone || "",
      },
      address_to: {
        name: destination.name,
        street1: destination.address_line_1,
        street2: "",
        city: destination.city,
        state: destination.state,
        zip: destination.postal_code,
        country: "US",
        phone: "",
      },
      parcels: [{
        length: String(packed.parcel.lengthIn),
        width: String(packed.parcel.widthIn),
        height: String(packed.parcel.heightIn),
        distance_unit: "in",
        weight: String(packed.parcel.weightLb),
        mass_unit: "lb",
      }],
      async: false,
    }),
  });

  const rates = Array.isArray((result.body as { rates?: unknown[] } | null)?.rates)
    ? ((result.body as { rates: Array<Record<string, unknown>> }).rates)
    : [];
  const allowed = parseAllowedServices(settings?.shippo_allowed_services);
  const mapped = mapShippoRates(result.body, allowed);

  return NextResponse.json({
    shippoMode: creds.mode,
    origin,
    destination,
    product: { slug: product.slug, quantity },
    parcel: packed.parcel,
    carrierAccounts: accounts,
    httpStatus: result.status,
    ok: result.ok,
    shipmentMessages: (result.body as { messages?: unknown } | null)?.messages ?? null,
    rawProviders: rates.map((rate) => ({
      provider: rate.provider,
      carrier_account: rate.carrier_account,
      servicelevel: rate.servicelevel ?? { name: rate.servicelevel_name, token: rate.servicelevel_token },
      amount: rate.amount,
      estimated_days: rate.estimated_days,
      messages: rate.messages ?? null,
    })),
    mapped: mapped.map((rate) => ({
      provider: rate.provider,
      service: rate.service,
      serviceToken: rate.serviceToken,
      amount: rate.amount,
    })),
    upsRaw: rates.filter((rate) => String(rate.provider || "").toLowerCase().includes("ups") && !String(rate.provider || "").toLowerCase().includes("usps")).length,
    uspsRaw: rates.filter((rate) => String(rate.provider || "").toLowerCase().includes("usps")).length,
    upsMapped: mapped.filter((rate) => rate.provider === "ups").length,
    uspsMapped: mapped.filter((rate) => rate.provider === "usps").length,
    settings: {
      ups_enabled: settings?.ups_enabled,
      usps_enabled: settings?.usps_enabled,
      shippo_enabled: settings?.shippo_enabled,
      ups_rate_mode: settings?.ups_rate_mode,
      usps_rate_mode: settings?.usps_rate_mode,
    },
  });
}
