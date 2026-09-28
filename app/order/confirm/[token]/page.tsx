import { notFound } from "next/navigation";
import { pageMetadata } from "@/src/lib/page-metadata";
import { getGuestOrderConfirmation } from "@/src/lib/checkout/guest-order";
import { OrderConfirmationExperience } from "@/src/components/checkout/order-confirmation-experience";
import { SiteHeader } from "@/src/components/layout/site-header";
import { Footer } from "@/src/components/layout/footer";

export const metadata = pageMetadata("Order confirmation", "View your Ivoire Shop order confirmation.", "/order/confirm", false);

export default async function GuestOrderConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getGuestOrderConfirmation(token);
  if (result.kind === "missing") notFound();
  const order = result.order;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-8">
        <OrderConfirmationExperience
          emailSent={order.payment_status === "paid"}
          fulfillmentMethod={order.fulfillment_method}
          receipt={{
            order_id: String(order.order_id),
            order_number: String(order.order_number),
            status: String(order.status),
            total: Number(order.total),
            confirmation_code: String(order.confirmation_code),
            payment_status: String(order.payment_status),
            fulfillment_method: String(order.fulfillment_method),
            customer_email: String(order.customer_email),
            customer_name: String(order.customer_name),
            payment_method: order.payment_method,
            payment_provider: order.payment_provider,
          }}
          viewHref={`/order/confirm/${token}`}
        />
      </main>
      <Footer />
    </>
  );
}
