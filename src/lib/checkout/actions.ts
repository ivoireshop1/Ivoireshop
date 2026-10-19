"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { checkoutFailure, logCheckoutFailure, validateCheckout, type CheckoutReceipt, type CheckoutResponse } from "./checkout-validation";
import { STORE_CLOSED_MESSAGE, STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { trySendOrderConfirmation } from "@/src/lib/communications/send-confirmation";
import { recordCheckoutNotifications } from "@/src/lib/notifications/record";
import { collectCheckoutOptions, optionToSnapshot } from "@/src/lib/delivery/orchestrate";
import type { DeliveryOption } from "@/src/lib/delivery/types";
import { IVOIRE_SHIPPING_RETIRED_MESSAGE, isRetiredIvoireShippingSelection } from "@/src/lib/delivery/checkout-eligibility";
import { liveServiceKey, liveServiceKeyFromOptionId, resolveSelectedShippingOption } from "@/src/lib/shipping/shippo";
import { originFromSettings, originIsComplete, pickupLocationSnapshot } from "@/src/lib/delivery/origin";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { centsToUsdString, usdToCents } from "@/src/lib/payments/money";
import { getStripeConfig } from "@/src/lib/payments/stripe-config";
import { taxSnapshotFromSettings, type TaxLine, type TaxSettings } from "@/src/lib/tax/totals";

export type PreResolvedCheckoutShipping = {
  selected: DeliveryOption;
  shipping: number;
  tax: number;
  taxLines?: TaxLine[];
  taxSettings: TaxSettings;
  subtotal: number;
  breakdowns: Record<string, { shipping: number; tax: number; total: number; taxLines?: TaxLine[] }>;
};

export async function placeCheckoutOrder(
  input: unknown,
  options?: { demo?: boolean; suppressEmail?: boolean; preResolved?: PreResolvedCheckoutShipping },
): Promise<CheckoutResponse> {
  const validated = validateCheckout(input);
  if (validated.error) return { success: false, error: validated.error, retrySame: false };
  const request = validated.request!;
  try {
    const supabase = await createClient();
    const { data: store } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
    if (store && store.is_open === false) {
      return { success: false, error: STORE_CLOSED_MESSAGE, retrySame: false };
    }
    const { data: catalog } = await supabase
      .from("products")
      .select("id, price, selling_method, selling_unit, unit_increment, min_sell_qty, max_sell_qty, package_weight_lb, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
      .in("id", request.items.map((item) => item.product_id));
    const byId = new Map((catalog ?? []).map((row) => [row.id, row]));
    const selectedId = request.deliveryOptionId || (request.fulfillmentMethod === "local_pickup" ? "pickup" : "store");
    if (isRetiredIvoireShippingSelection(selectedId)) {
      return { success: false, error: IVOIRE_SHIPPING_RETIRED_MESSAGE, retrySame: false };
    }
    let selected: DeliveryOption;
    let breakdown: { shipping: number; tax: number; total: number; taxLines?: TaxLine[] } | undefined;
    let quotesTax: TaxSettings;
    let quotesSubtotal: number;

    if (options?.preResolved) {
      // Stripe prepare already revalidated against Shippo — do not burn a second live quote.
      const pre = options.preResolved;
      const sameSelection = pre.selected.id === selectedId
        || (
          selectedId.includes(":live:")
          && pre.selected.rateMode === "live_api"
          && liveServiceKey(pre.selected) === liveServiceKeyFromOptionId(selectedId)
        );
      const amountOk = request.quotedShipping == null
        || Math.abs(pre.shipping - request.quotedShipping) < 0.015;
      if (!sameSelection || !amountOk) {
        return { success: false, error: "The live shipping quote changed. Review the new rate before placing the order.", retrySame: false };
      }
      if (pre.selected.rateMode === "live_api" && (request.quotedShipping == null || !Number.isFinite(request.quotedShipping))) {
        return { success: false, error: "Confirm your shipping rate before paying. Your address and cart were kept.", retrySame: false };
      }
      selected = pre.selected;
      breakdown = {
        shipping: pre.shipping,
        tax: pre.tax,
        total: pre.shipping + pre.tax,
        taxLines: pre.taxLines,
      };
      quotesTax = pre.taxSettings;
      quotesSubtotal = pre.subtotal;
    } else {
      const quotes = await collectCheckoutOptions({
        destination: request.address,
        products: request.items.map((item) => ({ quantity: item.quantity, ...byId.get(item.product_id) })),
      });
      const resolved = resolveSelectedShippingOption(quotes.options, selectedId, request.fulfillmentMethod, request.quotedShipping);
      if ("error" in resolved) {
        const busy = Boolean(quotes.message && /too many requests|10429|rate.?limit|briefly busy|temporarily busy|temporary carrier gap/i.test(quotes.message));
        const liveCarrier = selectedId.startsWith("ups:") ? "ups" : selectedId.startsWith("usps:") ? "usps" : null;
        const omitted = Boolean(
          liveCarrier
          && (quotes.expectedLiveCarriers ?? []).includes(liveCarrier)
          && !quotes.options.some((option) => option.provider === liveCarrier && option.rateMode === "live_api"),
        );
        if (busy || omitted) {
          return {
            success: false,
            error: "UPS/USPS rates are briefly busy. Wait a few seconds and try again — your cart and address were kept.",
            retrySame: true,
          };
        }
        return { success: false, error: resolved.error, retrySame: false };
      }
      selected = resolved.option;
      breakdown = quotes.breakdowns[selected.id];
      quotesTax = quotes.tax;
      quotesSubtotal = quotes.subtotal;
    }
    let shipping = breakdown?.shipping ?? selected.amount;
    let tax = breakdown?.tax ?? 0;
    const admin = createAdminClient();
    const demo = options?.demo === true;
    if ((shipping > 0 || tax > 0) && !admin && !demo) {
      return { success: false, error: "Shipping and tax totals are not fully configured yet. Choose pickup or contact the store.", retrySame: false };
    }
    const origin = originFromSettings(store);
    const pickupLocation = request.fulfillmentMethod === "local_pickup" && originIsComplete(origin) ? pickupLocationSnapshot(origin) : null;
    const { data, error } = await supabase.rpc("create_checkout_order", {
      p_items: request.items,
      p_customer_name: request.customerName,
      p_customer_email: request.customerEmail,
      p_customer_phone: request.customerPhone,
      p_shipping_address: request.fulfillmentMethod === "delivery" ? request.address : { fulfillment_method: "local_pickup", pickup_location: pickupLocation },
      p_fulfillment_method: request.fulfillmentMethod,
      p_idempotency_key: request.idempotencyKey,
      p_is_demo: demo,
    });
    if (error) {
      logCheckoutFailure("create_checkout_order", error);
      return checkoutFailure(error.code, error.message);
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.order_id || !row.order_number || !row.status || !Number.isFinite(Number(row.total)) || Number(row.total) < 0) {
      logCheckoutFailure("create_checkout_order_row", { code: "empty", message: "RPC returned without a usable order row." });
      return checkoutFailure();
    }
    if (demo) {
      const applied = await supabase.rpc("apply_demo_order_charges", {
        p_order_id: row.order_id,
        p_shipping: shipping,
        p_tax: tax,
        p_fulfillment_provider: selected.provider,
        p_fulfillment_service: selected.serviceCode || selected.label,
        p_delivery_snapshot: optionToSnapshot(selected, pickupLocation),
          p_tax_snapshot: taxSnapshotFromSettings(quotesTax, tax, breakdown?.taxLines ?? []),
        });
        if (applied.error) {
          logCheckoutFailure("apply_demo_order_charges", applied.error);
          return checkoutFailure(applied.error.code, applied.error.message);
        }
        const appliedTotal = Array.isArray(applied.data) ? Number(applied.data[0]?.total) : Number((applied.data as { total?: number } | null)?.total);
        if (Number.isFinite(appliedTotal)) row.total = appliedTotal;
      } else if (admin) {
        const { data: current } = await admin
          .from("orders")
          .select("subtotal, shipping_cost, tax_amount, total, fulfillment_provider, tax_snapshot, payment_status")
          .eq("id", row.order_id)
          .maybeSingle();
        const unpaid = current?.payment_status !== "paid" && current?.payment_status !== "partially_refunded" && current?.payment_status !== "refunded";
        if (unpaid) {
          const subtotalCents = usdToCents(current?.subtotal ?? row.total);
          const shippingCents = usdToCents(shipping);
          const taxCents = usdToCents(tax);
          const total = Number(centsToUsdString(subtotalCents + shippingCents + taxCents));
          await admin.from("orders").update({
            shipping_cost: shipping,
            tax_amount: tax,
            total,
            fulfillment_provider: selected.provider,
            fulfillment_service: selected.serviceCode || selected.label,
            shipping_mode: selected.mode || ((selected.provider === "ups" || selected.provider === "usps") ? "manual" : null),
            delivery_snapshot: optionToSnapshot(selected, pickupLocation),
            tax_snapshot: taxSnapshotFromSettings(quotesTax, tax, breakdown?.taxLines ?? []),
          }).eq("id", row.order_id).neq("payment_status", "paid");
          row.total = total;
        } else if (current) {
          row.total = current.total;
          shipping = Number(current.shipping_cost ?? shipping);
          tax = Number(current.tax_amount ?? tax);
        }
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
        is_demo: options?.demo === true || row.payment_provider === "demo" || row.payment_status === "demo",
        email_sent: false,
        account_order: Boolean(user),
        fulfillment_provider: selected.provider,
        fulfillment_service: selected.serviceCode || selected.label,
        subtotal: quotesSubtotal,
        shipping_cost: shipping,
        tax_amount: tax,
        tax_lines: breakdown?.taxLines,
      };
      let emailSent = false;
    const stripeOnline = getStripeConfig().canCollect;
    const skipOutbound = Boolean(options?.demo || options?.suppressEmail);
    if (!skipOutbound && !stripeOnline) {
      try {
        if (receipt.guest_access_token) {
          const confirmation = await supabase.rpc("get_checkout_confirmation", { p_access_token: receipt.guest_access_token });
          const details = Array.isArray(confirmation.data) ? confirmation.data[0] : confirmation.data;
          emailSent = await trySendOrderConfirmation(details ?? {});
        }
      } catch {
        console.error("[order-email] confirmation failed", { orderNumber: receipt.order_number });
      }
    }
    receipt.email_sent = emailSent;
    try {
      if (!skipOutbound && !stripeOnline) await recordCheckoutNotifications(supabase, receipt.order_id, receipt.payment_status, emailSent, Boolean(user));
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
  } catch (error) {
    logCheckoutFailure("place_checkout_order", error);
    return checkoutFailure();
  }
}
