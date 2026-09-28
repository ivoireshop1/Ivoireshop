import { pageMetadata } from "@/src/lib/page-metadata";
import { CartPage } from "@/src/components/cart/cart-page";
import { Suspense } from "react";
import { Footer } from "@/src/components/layout/footer";
import { SiteHeader } from "@/src/components/layout/site-header";

export const metadata = pageMetadata("Your Cart", "Review your cart before checkout.", "/cart", false);

export default function CartRoute() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="mx-auto w-full max-w-7xl px-5 py-16">Loading cart...</main>}>
        <CartPage />
      </Suspense>
      <Footer />
    </>
  );
}
