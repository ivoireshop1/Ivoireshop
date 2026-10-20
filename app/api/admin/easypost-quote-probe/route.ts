import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings, originIsComplete } from "@/src/lib/delivery/origin";
import { easypostCredentials, quoteEasyPostShipment } from "@/src/lib/shipping/easypost";
import { cartParcel } from "@/src/lib/shipping/live-quotes";
import { parseAllowedServices } from "@/src/lib/shipping/shippo";

export const runtime = "nodejs";

function parseParcel(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { weightLb?: unknown; lengthIn?: unknown; widthIn?: unknown; heightIn?: unknown };
  const weightLb = Number(row.weightLb);
  const lengthIn = Number(row.lengthIn);
  const widthIn = Number(row.widthIn);
  const heightIn = Number(row.heightIn);
  if (![weightLb, lengthIn, widthIn, heightIn].every((value) => Number.isFinite(value) && value > 0)) return null;
  return { weightLb, lengthIn, widthIn, heightIn };
}

/** Admin-only rate retrieval. Never buys postage. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Admin required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin required." }, { status: 403 });

  const creds = easypostCredentials();
  if (!creds.configured) {
    return NextResponse.json({ error: "EASYPOST_API_KEY is not configured.", configured: false }, { status: 503 });
  }

  let body: {
    destination?: {
      name?: string;
      address_line_1?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    parcel?: unknown;
    productSlug?: string;
    quantity?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const origin = originFromSettings(settings);
  if (!originIsComplete(origin)) {
    return NextResponse.json({ error: "Store origin is incomplete." }, { status: 422 });
  }

  let parcel = parseParcel(body.parcel);
  let parcelSource = parcel ? "admin_supplied" : null;
  if (!parcel && body.productSlug) {
    const { data: product } = await supabase
      .from("products")
      .select("id, slug, selling_method, selling_unit, unit_increment, min_sell_qty, max_sell_qty, package_weight_lb, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
      .eq("slug", String(body.productSlug))
      .maybeSingle();
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const packed = cartParcel([{ ...product, quantity: Number(body.quantity ?? 1) }]);
    parcel = packed.parcel;
    parcelSource = packed.parcel ? "product_shipping_fields" : null;
  }
  if (!parcel) {
    return NextResponse.json({
      error: "A verified parcel is required. Supply weight and dimensions, or a product that already has shipping measurements.",
    }, { status: 422 });
  }

  const destination = {
    name: body.destination?.name || "Quote probe",
    address_line_1: body.destination?.address_line_1 || "1210 Rockbridge Rd NW",
    city: body.destination?.city || "Norcross",
    state: body.destination?.state || "GA",
    postal_code: body.destination?.postal_code || "30093",
    country: body.destination?.country || "US",
  };
  const quoted = await quoteEasyPostShipment({
    origin,
    destination,
    parcel,
    allowedServices: parseAllowedServices(settings?.shippo_allowed_services),
  });
  return NextResponse.json({
    ok: quoted.ok,
    error: quoted.ok ? null : quoted.error,
    mode: creds.mode,
    test: creds.isTest,
    postagePurchased: false,
    parcelSource,
    parcel,
    ups: quoted.ok ? quoted.rates.filter((rate) => rate.provider === "ups").map((rate) => ({
      service: rate.service,
      amount: rate.amount,
      estimatedDays: rate.estimatedDays,
      test: rate.test,
    })) : [],
    usps: quoted.ok ? quoted.rates.filter((rate) => rate.provider === "usps").map((rate) => ({
      service: rate.service,
      amount: rate.amount,
      estimatedDays: rate.estimatedDays,
      test: rate.test,
    })) : [],
  });
}
