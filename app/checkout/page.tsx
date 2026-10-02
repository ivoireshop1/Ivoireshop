import { pageMetadata } from "@/src/lib/page-metadata";
import { CheckoutPage } from "@/src/components/cart/checkout-page";
import { Suspense } from "react";
import { isStoreOpen } from "@/src/lib/store/status";
import { getPaymentReadiness } from "@/src/lib/payments/readiness";
import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings, originIsComplete } from "@/src/lib/delivery/origin";

export const metadata = pageMetadata("Checkout", "Submit your order with your contact and fulfillment details.", "/checkout", false);

export default async function CheckoutRoute() {
  const supabase = await createClient();
  const [{ data: store }, storeOpen, payments] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle(),
    isStoreOpen(),
    Promise.resolve(getPaymentReadiness()),
  ]);
  const origin = originFromSettings(store);
  const pickupOrigin = originIsComplete(origin) ? origin : null;
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-4xl px-5 py-16">Loading checkout...</main>}>
      <CheckoutPage payments={payments} pickupOrigin={pickupOrigin} storeOpen={storeOpen} />
    </Suspense>
  );
}
