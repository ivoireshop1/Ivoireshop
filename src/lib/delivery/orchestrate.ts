import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings, originIsComplete } from "./origin";
import { combinePackages, packageFromProduct } from "./package";
import { quoteDoorDash } from "./providers/doordash";
import { quoteUps } from "./providers/ups";
import { quoteUsps } from "./providers/usps";
import { sanitizeProviderError, type DeliveryOption } from "./types";

function logDelivery(provider: string, operation: string, success: boolean, message?: string) {
  console.info("[delivery]", {
    provider,
    operation,
    success,
    timestamp: new Date().toISOString(),
    message: message ? sanitizeProviderError(message) : undefined,
  });
}

export async function collectCheckoutOptions(input: {
  destination: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  products: Array<{
    quantity: number;
    ship_weight_lb?: number | string | null;
    ship_length_in?: number | string | null;
    ship_width_in?: number | string | null;
    ship_height_in?: number | string | null;
  }>;
}): Promise<{ options: DeliveryOption[]; message?: string }> {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const origin = originFromSettings(settings);
  const options: DeliveryOption[] = [];
  if (settings?.pickup_enabled !== false) {
    options.push({
      id: "pickup",
      provider: "pickup",
      fulfillmentMethod: "local_pickup",
      label: "Pickup · Store Pickup",
      amount: 0,
    });
  }
  if (settings?.store_delivery_enabled !== false) {
    options.push({
      id: "store",
      provider: "store",
      fulfillmentMethod: "delivery",
      label: "Delivery · Arranged by Ivoire Shop",
      amount: 0,
    });
  }

  const pkg = combinePackages(
    input.products
      .map((product) => {
        const pack = packageFromProduct(product);
        if (!pack) return null;
        return { ...pack, weightLb: pack.weightLb * product.quantity };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
  );

  if (!originIsComplete(origin)) {
    return { options, message: options.length ? undefined : "Delivery origin is not configured yet." };
  }

  const destReady = Boolean(input.destination.address_line_1 && input.destination.city && input.destination.country);
  if (destReady && settings?.doordash_enabled) {
    const quoted = await quoteDoorDash({ origin, destination: input.destination });
    logDelivery("doordash", "quote", !quoted.error, quoted.error);
    options.push(...quoted.options);
  }
  if (destReady && pkg && settings?.ups_enabled) {
    const quoted = await quoteUps({ origin, destination: input.destination, pkg });
    logDelivery("ups", "quote", !quoted.error, quoted.error);
    options.push(...quoted.options);
  } else if (settings?.ups_enabled && destReady && !pkg) {
    logDelivery("ups", "quote", false, "Missing package data");
  }
  if (destReady && pkg && settings?.usps_enabled) {
    const quoted = await quoteUsps({ origin, destination: input.destination, pkg });
    logDelivery("usps", "quote", !quoted.error, quoted.error);
    options.push(...quoted.options);
  } else if (settings?.usps_enabled && destReady && !pkg) {
    logDelivery("usps", "quote", false, "Missing package data");
  }

  if (!options.length) {
    return { options, message: "No delivery methods are available right now. Please try pickup later or contact the store." };
  }
  return { options };
}

export function optionToSnapshot(option: DeliveryOption) {
  return {
    provider: option.provider,
    service: option.serviceCode || option.label,
    amount: option.amount,
    estimate: option.estimate || null,
    quoted_at: new Date().toISOString(),
  };
}
