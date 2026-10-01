"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { checkoutFailure, validateCheckout, type CheckoutReceipt, type CheckoutResponse } from "./checkout-validation";
import { STORE_CLOSED_MESSAGE, STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { trySendOrderConfirmation } from "@/src/lib/communications/send-confirmation";
import { recordCheckoutNotifications } from "@/src/lib/notifications/record";
import { collectCheckoutOptions, optionToSnapshot } from "@/src/lib/delivery/orchestrate";
import { createAdminClient } from "@/src/lib/supabase/admin";

export async function placeCheckoutOrder(input: unknown): Promise<CheckoutResponse> {
  const validated = validateCheckout(input);
  if (validated.error) return { success: false, error: validated.error, retrySame: false };
  const request = validated.request!;
  try {
    const supabase = await createClient();
    const { data: store } = await supabase.from("store_settings").select("is_open").eq("id", STORE_SETTINGS_ID).maybeSingle();
    if (store && store.is_open === false) {
      return { success: false, error: STORE_CLOSED_MESSAGE, retrySame: false };
    }
    const { data: catalog } = await supabase
      .from("products")
      .select("id, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
      .in("id", request.items.map((item) => item.product_id));
    const byId = new Map((catalog ?? []).map((row) => [row.id, row]));
    const quotes = await collectCheckoutOptions({
      destination: request.address,
      products: request.items.map((item) => ({ quantity: item.quantity, ...byId.get(item.product_id) })),
    });
    const selectedId = request.deliveryOptionId || (request.fulfillmentMethod === "local_pickup" ? "pickup" : "store");
    const selected = quotes.options.find((option) => option.id === selectedId);
    if (!selected || selected.fulfillmentMethod !== request.fulfillmentMethod) {
      return { success: false, error: "Choose an available pickup or delivery option.", retrySame: false };
    }
    const admin = createAdminClient();
    if (selected.amount > 0 && !admin) {
      return { success: false, error: "Carrier shipping is not fully configured yet. Choose pickup or store-arranged delivery.", retrySame: false };
    }
    const { data, error } = await supabase.rpc("create_checkout_order", {
      p_items: request.items,
      p_customer_name: request.customerName,
      p_customer_email: request.customerEmail,
      p_customer_phone: request.customerPhone,
      p_shipping_address: request.fulfillmentMethod === "delivery" ? request.address : { fulfillment_method: "local_pickup" },
      p_fulfillment_method: request.fulfillmentMethod,
      p_idempotency_key: request.idempotencyKey,
    });
    if (error) return checkoutFailure(error.code, error.message);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.order_id || !row.order_number || !row.status || !Number.isFinite(Number(row.total)) || Number(row.total) < 0) return checkoutFailure();
    if (admin) {
      const subtotal = Number(row.total);
      const shipping = selected.amount;
      const total = Number((subtotal + shipping).toFixed(2));
      await admin.from("orders").update({
        shipping_cost: shipping,
        total,
        fulfillment_provider: selected.provider,
        fulfillment_service: selected.serviceCode || selected.label,
        delivery_snapshot: optionToSnapshot(selected),
      }).eq("id", row.order_id);
      row.total = total;
    }
    let user = null;
    try {
      const auth = await supabase.auth.getUser();
      user = auth.data.user;
    } catch { /* The order is already committed; View Order can still use the guest token. */ }
    const receipt: CheckoutReceipt = {
      order_id: String(row.order_id),
      order_number: String(row.order_number),
      status: String(row.status),
      total: Number(row.total),
      confirmation_code: row.confirmation_code ? String(row.confirmation_code) : undefined,
      guest_access_token: row.guest_access_token ? String(row.guest_access_token) : undefined,
      payment_status: row.payment_status ? String(row.payment_status) : "pending",
      fulfillment_method: row.fulfillment_method ? String(row.fulfillment_method) : undefined,
      customer_email: row.customer_email ? String(row.customer_email) : undefined,
      customer_name: row.customer_name ? String(row.customer_name) : undefined,
      payment_method: row.payment_method ? String(row.payment_method) : null,
      payment_provider: row.payment_provider ? String(row.payment_provider) : null,
      email_sent: false,
      account_order: Boolean(user),
      fulfillment_provider: selected.provider,
      fulfillment_service: selected.serviceCode || selected.label,
    };
    let emailSent = false;
    try {
      if (receipt.guest_access_token) {
        const confirmation = await supabase.rpc("get_checkout_confirmation", { p_access_token: receipt.guest_access_token });
        const details = Array.isArray(confirmation.data) ? confirmation.data[0] : confirmation.data;
        emailSent = await trySendOrderConfirmation(details ?? {});
      }
    } catch {
      console.error("[order-email] confirmation failed", { orderNumber: receipt.order_number });
    }
    receipt.email_sent = emailSent;
    try {
      await recordCheckoutNotifications(supabase, receipt.order_id, receipt.payment_status, emailSent, Boolean(user));
    } catch {
      console.error("[order-notification] confirmation failed", { orderNumber: receipt.order_number });
    }
    // A cache failure must not turn a committed order into a claimed checkout failure.
    try {
      for (const path of ["/", "/shop", "/categories", "/admin", "/admin/orders", "/admin/inventory", "/admin/products", "/admin/customers", "/account"]) revalidatePath(path);
      revalidatePath("/product/[slug]", "page");
      revalidatePath(`/admin/orders/${receipt.order_id}`);
      revalidatePath(`/account/orders/${receipt.order_id}`);
      revalidatePath("/account/notifications");
    } catch { /* Order is already committed; fresh requests still read the database. */ }
    return { success: true, receipt };
  } catch {
    return checkoutFailure();
  }
}
