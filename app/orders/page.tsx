import { SiteHeader } from "@/src/components/layout/site-header";
import { Footer } from "@/src/components/layout/footer";
import { GuestOrderTracker } from "@/src/components/checkout/guest-order-tracker";
import { pageMetadata } from "@/src/lib/page-metadata";
import { getEmailProviderStatus } from "@/src/lib/email/send";

export const metadata = pageMetadata(
  "Track My Order",
  "Track guest orders saved on this device at Ivoire Shop.",
  "/orders",
  false,
);

export default function GuestOrdersPage() {
  const email = getEmailProviderStatus();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 lg:px-8">
        <GuestOrderTracker emailConfigured={email.configured} />
      </main>
      <Footer />
    </>
  );
}
