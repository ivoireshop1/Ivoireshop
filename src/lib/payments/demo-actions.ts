"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { placeCheckoutOrder } from "@/src/lib/checkout/actions";
import { validateCheckout, type CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";
import { recordCheckoutNotifications } from "@/src/lib/notifications/record";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { clientQuotedTotalMatches } from "./totals";
import { usdToCents } from "./money";
import { isDemoOrder, restoreInventoryAllowed } from "./demo";

export async function readDemoPaymentEnabled() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_settings")
    .select("demo_payment_enabled")
    .eq("id", STORE_SETTINGS_ID)
    .maybeSingle();
  return data?.demo_payment_enabled === true;
}

export async function saveDemoPaymentEnabled(_prev: { error?: string; saved?: boolean; enabled?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const { error } = await supabase
    .from("store_settings")
    .update({ demo_payment_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", STORE_SETTINGS_ID);
  if (error) return { error: "Demo payment could not be updated." };
  revalidatePath("/admin/payments");
  revalidatePath("/checkout");
  return { saved: true, enabled };
}

function demoReceipt(base: CheckoutReceipt): CheckoutReceipt {
  return {
    ...base,
    payment_provider: "demo",
    payment_method: "demo",
    payment_status: "demo",
    is_demo: true,
    email_sent: false,
  };
}

export async function placeDemoOrder(input: { checkout: unknown; expectedTotal?: number | null; demo?: unknown }) {
  void input.demo;
  const enabled = await readDemoPaymentEnabled();
  if (!enabled) return { success: false as const, error: "Demo payment is turned off." };
  const validated = validateCheckout(input.checkout);
  if (validated.error || !validated.request) return { success: false as const, error: validated.error || "Invalid checkout request." };

  const placed = await placeCheckoutOrder(validated.request, { demo: true, suppressEmail: true });
  if (!placed.success) return { success: false as const, error: placed.error };

  const order = {
    id: placed.receipt.order_id,
    total: placed.receipt.total,
    payment_status: placed.receipt.payment_status,
    payment_provider: placed.receipt.payment_provider,
    is_demo: placed.receipt.is_demo === true,
    inventory_restored: true,
  };
  if (order.payment_status === "paid" || order.payment_status === "partially_refunded" || order.payment_status === "refunded") {
    return { success: false as const, error: "This order is already paid." };
  }
  if (order.payment_provider === "stripe") {
    return { success: false as const, error: "This checkout was started with Stripe. Complete card payment or start a new checkout." };
  }
  if (input.expectedTotal != null && !clientQuotedTotalMatches(usdToCents(order.total), input.expectedTotal)) {
    return {
      success: false as const,
      error: "Checkout totals were updated. Review the new total before placing the demo order.",
      totalsChanged: true as const,
      total: Number(order.total),
    };
  }
  if (!isDemoOrder(order) || restoreInventoryAllowed(order)) {
    return { success: false as const, error: "Demo checkout refused because this order is not a demonstration record or still holds sellable stock." };
  }

  const supabase = await createClient();
  try {
    await recordCheckoutNotifications(supabase, order.id, "demo", false, Boolean(placed.receipt.account_order));
  } catch {
    /* In-app notifications are best-effort. */
  }
  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("customer_notifications")
      .update({
        title: "DEMO · Order accepted 🎉",
        message: "We've received your order and the Ivoire Shop team is getting started.\nThis is a demonstration. No real payment was collected.",
      })
      .eq("order_id", order.id)
      .eq("event_type", "order_confirmed");
    await admin
      .from("admin_notifications")
      .update({
        title: "DEMO order received",
        message: "Demonstration order. No real payment was collected.",
      })
      .eq("order_id", order.id)
      .eq("event_type", "new_order");
  }

  for (const path of ["/", "/shop", "/admin", "/admin/orders", "/admin/payments", "/admin/notifications", "/account", "/account/notifications"]) revalidatePath(path);
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/account/orders/${order.id}`);

  return { success: true as const, receipt: demoReceipt(placed.receipt) };
}
