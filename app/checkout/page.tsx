import { CheckoutPage } from "@/src/components/cart/checkout-page";
import { Suspense } from "react";

export default function CheckoutRoute() { return <Suspense fallback={<main className="mx-auto w-full max-w-4xl px-5 py-16">Loading checkout...</main>}><CheckoutPage /></Suspense>; }
