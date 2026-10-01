import { notFound } from "next/navigation";
import { pageMetadata } from "@/src/lib/page-metadata";
import { getGuestOrderConfirmation } from "@/src/lib/checkout/guest-order";
import { getCustomerOrder } from "@/src/lib/customer/orders";
import { viewOrderHref } from "@/src/lib/checkout/view-order-href";
import { OrderConfirmationExperience } from "@/src/components/checkout/order-confirmation-experience";
import { ShipmentTrackingPanel } from "@/src/components/orders/shipment-tracking-panel";
import { SiteHeader } from "@/src/components/layout/site-header";
import { Footer } from "@/src/components/layout/footer";
import { pickupLocationForOrder } from "@/src/components/store/pickup-location-block";

export const metadata = pageMetadata("Order confirmation", "View your Ivoire Shop order confirmation.", "/order/confirm", false);

export default async function GuestOrderConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getGuestOrderConfirmation(token);
  if (result.kind === "missing") notFound();
  const order = result.order;
  const orderId = String(order.order_id);
  let accountOrder = false;
  try {
    const owned = await getCustomerOrder(orderId);
    accountOrder = owned.kind === "found";
  } catch {
    accountOrder = false;
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-8">
        <OrderConfirmationExperience
          emailSent={false}
          fulfillmentMethod={order.fulfillment_method}
          pickupLocation={pickupLocationForOrder({
            fulfillment_method: String(order.fulfillment_method),
            shipping_address: order.shipping_address,
          })}
          receipt={{
            order_id: orderId,
            order_number: String(order.order_number),
            status: String(order.status),
            total: Number(order.total),
            confirmation_code: String(order.confirmation_code),
            payment_status: String(order.payment_status),
            fulfillment_method: String(order.fulfillment_method),
            fulfillment_provider: order.fulfillment_provider ? String(order.fulfillment_provider) : undefined,
            fulfillment_service: order.fulfillment_service ? String(order.fulfillment_service) : undefined,
            subtotal: Number(order.subtotal ?? order.total),
            shipping_cost: Number(order.shipping_cost ?? 0),
            tax_amount: Number(order.tax_amount ?? 0),
            tracking_number: order.tracking_number ? String(order.tracking_number) : undefined,
            shipped_at: order.shipped_at ? String(order.shipped_at) : undefined,
            customer_email: String(order.customer_email),
            customer_name: String(order.customer_name),
            payment_method: order.payment_method,
            payment_provider: order.payment_provider,
          }}
          viewHref={viewOrderHref({
            orderId,
            guestAccessToken: token,
            accountOrder,
          })}
        />
        <ShipmentTrackingPanel
          order={{
            fulfillment_method: String(order.fulfillment_method),
            fulfillment_provider: order.fulfillment_provider ? String(order.fulfillment_provider) : null,
            tracking_number: order.tracking_number ? String(order.tracking_number) : null,
            shipped_at: order.shipped_at ? String(order.shipped_at) : null,
            status: String(order.status),
          }}
        />
      </main>
      <Footer />
    </>
  );
}
