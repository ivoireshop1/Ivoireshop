"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { checkoutFailure, validateCheckout, type CheckoutResponse } from "./checkout-validation";
import { STORE_CLOSED_MESSAGE, STORE_SETTINGS_ID } from "@/src/lib/store/constants";

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
    const receipt = {
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
    };
    // A cache failure must not turn a committed order into a claimed checkout failure.
    try {
      for (const path of ["/", "/shop", "/categories", "/admin", "/admin/orders", "/admin/inventory", "/admin/products", "/admin/customers", "/account"]) revalidatePath(path);
      revalidatePath("/product/[slug]", "page");
      revalidatePath(`/admin/orders/${receipt.order_id}`);
      revalidatePath(`/account/orders/${receipt.order_id}`);
    } catch { /* Order is already committed; fresh requests still read the database. */ }
    return { success: true, receipt };
  } catch {
    return checkoutFailure();
  }
}
